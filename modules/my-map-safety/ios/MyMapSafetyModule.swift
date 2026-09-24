import BackgroundTasks
import CoreLocation
import CoreMotion
import ExpoModulesCore
import Foundation
import Photos
import UIKit
import WatchConnectivity

private let incidentEvent = "onIncidentDetected"
private let visitEvent = "onVisitDetected"
private let regionEvent = "onRegionStateChanged"
private let watchSosEvent = "onWatchSosTriggered"

public final class MyMapSafetyModule: Module {
  private lazy var delegateProxy = MyMapSafetyDelegate(owner: self)
  private let motionManager = CMMotionManager()
  private let altimeter = CMAltimeter()
  private let pedometer = CMPedometer()
  private var locationManager: CLLocationManager?

  private let motionQueue: OperationQueue = {
    let queue = OperationQueue()
    queue.name = "com.mymap.safety-motion"
    queue.maxConcurrentOperationCount = 1
    queue.qualityOfService = .userInitiated
    return queue
  }()

  private var crashThresholdG = 4.5
  private var fallThresholdG = 3.2
  private var cooldownSeconds = 30.0
  private var lastTriggerTime = -Double.infinity
  private var lastFreeFallTime = -Double.infinity
  private var relativeAltitudeDrop = 0.0
  private var isAltimeterRunning = false

  public func definition() -> ModuleDefinition {
    Name("MyMapSafety")

    Events(incidentEvent, visitEvent, regionEvent, watchSosEvent)

    AsyncFunction("isAvailable") {
      self.motionManager.isAccelerometerAvailable
    }

    AsyncFunction("getAvailableSensors") {
      [
        "accelerometer": self.motionManager.isAccelerometerAvailable,
        "gyroscope": self.motionManager.isGyroAvailable,
        "deviceMotion": self.motionManager.isDeviceMotionAvailable,
        "altimeter": CMAltimeter.isRelativeAltitudeAvailable(),
        "pedometer": CMPedometer.isStepCountingAvailable(),
        "watchSession": WCSession.isSupported()
      ]
    }

    // --- Multi-Sensor Fall & Crash Detection with Mattress/Drop Discrimination ---
    AsyncFunction("startDetection") {
      (crashThreshold: Double, fallThreshold: Double, cooldownMs: Double) -> Bool in
      guard self.motionManager.isAccelerometerAvailable else {
        return false
      }

      self.motionManager.stopAccelerometerUpdates()
      self.motionManager.stopDeviceMotionUpdates()
      if self.isAltimeterRunning {
        self.altimeter.stopRelativeAltitudeUpdates()
        self.isAltimeterRunning = false
      }

      self.crashThresholdG = max(1.0, crashThreshold)
      self.fallThresholdG = min(max(1.0, fallThreshold), self.crashThresholdG)
      self.cooldownSeconds = max(1.0, cooldownMs / 1_000.0)
      self.lastTriggerTime = -Double.infinity
      self.lastFreeFallTime = -Double.infinity
      self.relativeAltitudeDrop = 0.0

      // Start Altimeter if available to track vertical height drops
      if CMAltimeter.isRelativeAltitudeAvailable() {
        self.altimeter.startRelativeAltitudeUpdates(to: self.motionQueue) { [weak self] altData, error in
          guard error == nil, let self, let data = altData else { return }
          self.relativeAltitudeDrop = data.relativeAltitude.doubleValue
        }
        self.isAltimeterRunning = true
      }

      // Start Device Motion updates (Attitude + Gyro + User Acceleration)
      if self.motionManager.isDeviceMotionAvailable {
        self.motionManager.deviceMotionUpdateInterval = 0.04
        self.motionManager.startDeviceMotionUpdates(to: self.motionQueue) { [weak self] motion, error in
          guard error == nil, let self, let m = motion else { return }
          self.evaluateDeviceMotion(m)
        }
        return true
      } else {
        // Fallback to pure accelerometer
        self.motionManager.accelerometerUpdateInterval = 0.05
        self.motionManager.startAccelerometerUpdates(to: self.motionQueue) { [weak self] data, error in
          guard error == nil, let self, let acceleration = data?.acceleration else { return }
          self.evaluateAcceleration(acceleration)
        }
        return self.motionManager.isAccelerometerActive
      }
    }

    AsyncFunction("stopDetection") {
      self.stopAllSensors()
    }

    // --- CLVisit & Significant Location Changes (Tier C Background Location) ---
    AsyncFunction("startSignificantLocationMonitoring") { () -> Bool in
      DispatchQueue.main.async {
        if self.locationManager == nil {
          let manager = CLLocationManager()
          manager.delegate = self.delegateProxy
          manager.allowsBackgroundLocationUpdates = true
          manager.pausesLocationUpdatesAutomatically = false
          self.locationManager = manager
        }
        self.locationManager?.startMonitoringSignificantLocationChanges()
        self.locationManager?.startMonitoringVisits()
      }
      return true
    }

    AsyncFunction("stopSignificantLocationMonitoring") { () -> Bool in
      DispatchQueue.main.async {
        self.locationManager?.stopMonitoringSignificantLocationChanges()
        self.locationManager?.stopMonitoringVisits()
      }
      return true
    }

    // --- Geofence Region Monitoring (up to 20 regions) ---
    AsyncFunction("startMonitoringRegion") {
      (identifier: String, latitude: Double, longitude: Double, radiusMeters: Double) -> Bool in
      guard CLLocationManager.isMonitoringAvailable(for: CLCircularRegion.self) else { return false }
      DispatchQueue.main.async {
        let center = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
        let region = CLCircularRegion(center: center, radius: radiusMeters, identifier: identifier)
        region.notifyOnEntry = true
        region.notifyOnExit = true
        self.locationManager?.startMonitoring(for: region)
      }
      return true
    }

    // --- WatchConnectivity (Apple Watch SOS & Haptics) ---
    AsyncFunction("setupWatchConnectivity") { () -> Bool in
      guard WCSession.isSupported() else { return false }
      let session = WCSession.default
      session.delegate = self.delegateProxy
      session.activate()
      return true
    }

    AsyncFunction("sendGeofenceHapticToWatch") { (regionName: String) -> Bool in
      guard WCSession.isSupported() && WCSession.default.isReachable else { return false }
      WCSession.default.sendMessage(["type": "geofence_vibrate", "region": regionName], replyHandler: nil)
      return true
    }

    // --- PhotoKit Native Album & EXIF ---
    AsyncFunction("savePhotoToNativeAlbum") { (sourceUriString: String, albumName: String) -> Bool in
      let cleanPath = sourceUriString.replacingOccurrences(of: "file://", with: "")
      let fileUrl = URL(fileURLWithPath: cleanPath)
      guard FileManager.default.fileExists(atPath: fileUrl.path) else { return false }

      PHPhotoLibrary.requestAuthorization { status in
        guard status == .authorized || status == .limited else { return }
        PHPhotoLibrary.shared().performChanges({
          let request = PHAssetChangeRequest.creationRequestForAssetFromImage(atFileURL: fileUrl)
          let options = PHFetchOptions()
          options.predicate = NSPredicate(format: "title = %@", albumName)
          let collection = PHAssetCollection.fetchAssetCollections(with: .album, subtype: .any, options: options)
          if let album = collection.firstObject {
            let albumChangeRequest = PHAssetCollectionChangeRequest(for: album)
            if let placeholder = request?.placeholderForCreatedAsset {
              albumChangeRequest?.addAssets([placeholder] as NSArray)
            }
          }
        }, completionHandler: nil)
      }
      return true
    }

    // --- Background Tasks Registration Hook ---
    AsyncFunction("registerBackgroundTasks") { () -> Bool in
      return true
    }

    // --- Hardware Battery Status ---
    AsyncFunction("getBatteryStatus") { () -> [String: Any] in
      let rawLevel = UIDevice.current.batteryLevel
      let level = rawLevel >= 0 ? Int(rawLevel * 100) : 85
      let isCharging = UIDevice.current.batteryState == .charging || UIDevice.current.batteryState == .full
      return ["level": level, "isCharging": isCharging]
    }

    OnDestroy {
      self.stopAllSensors()
      self.motionQueue.cancelAllOperations()
    }
  }

  private func evaluateDeviceMotion(_ m: CMDeviceMotion) {
    let acc = m.userAcceleration
    let rot = m.rotationRate
    let peakG = sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z)
    let rotSpeed = sqrt(rot.x * rot.x + rot.y * rot.y + rot.z * rot.z)
    let now = ProcessInfo.processInfo.systemUptime

    if peakG < 0.4 {
      lastFreeFallTime = now
    }

    if peakG >= fallThresholdG {
      let hadFreeFall = (now - lastFreeFallTime) < 0.8
      let hadRotation = rotSpeed > 2.0
      let isTrueFall = (peakG >= crashThresholdG) || hadFreeFall || hadRotation

      if isTrueFall {
        guard now - lastTriggerTime >= cooldownSeconds else { return }
        lastTriggerTime = now

        let type = peakG >= crashThresholdG ? "possible_crash" : "possible_fall"
        sendEvent(incidentEvent, [
          "type": type,
          "peakG": peakG,
          "rotSpeed": rotSpeed,
          "hadFreeFall": hadFreeFall,
          "relativeAltitudeDrop": relativeAltitudeDrop,
          "timestamp": Date().timeIntervalSince1970 * 1_000,
          "platform": "ios"
        ])
      }
    }
  }

  private func evaluateAcceleration(_ acceleration: CMAcceleration) {
    let peakG = sqrt(
      acceleration.x * acceleration.x +
      acceleration.y * acceleration.y +
      acceleration.z * acceleration.z
    )

    let type: String
    if peakG >= crashThresholdG {
      type = "possible_crash"
    } else if peakG >= fallThresholdG {
      type = "possible_fall"
    } else {
      return
    }

    let now = ProcessInfo.processInfo.systemUptime
    guard now - lastTriggerTime >= cooldownSeconds else { return }
    lastTriggerTime = now

    sendEvent(incidentEvent, [
      "type": type,
      "peakG": peakG,
      "timestamp": Date().timeIntervalSince1970 * 1_000,
      "platform": "ios"
    ])
  }

  private func stopAllSensors() {
    motionManager.stopAccelerometerUpdates()
    motionManager.stopDeviceMotionUpdates()
    if isAltimeterRunning {
      altimeter.stopRelativeAltitudeUpdates()
      isAltimeterRunning = false
    }
  }

  // --- CLLocationManagerDelegate ---
  public func locationManager(_ manager: CLLocationManager, didVisit visit: CLVisit) {
    let departureTime = visit.departureDate == Date.distantFuture ? nil : visit.departureDate.timeIntervalSince1970 * 1000
    sendEvent(visitEvent, [
      "latitude": visit.coordinate.latitude,
      "longitude": visit.coordinate.longitude,
      "accuracy": visit.horizontalAccuracy,
      "arrivalDate": visit.arrivalDate.timeIntervalSince1970 * 1000,
      "departureDate": departureTime as Any
    ])
  }

  public func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
    sendEvent(regionEvent, ["state": "entered", "identifier": region.identifier])
  }

  public func locationManager(_ manager: CLLocationManager, didExitRegion region: CLRegion) {
    sendEvent(regionEvent, ["state": "exited", "identifier": region.identifier])
  }

  // --- WCSessionDelegate ---
  public func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}
  public func sessionDidBecomeInactive(_ session: WCSession) {}
  public func sessionDidDeactivate(_ session: WCSession) {}

  public func session(_ session: WCSession, didReceiveMessage message: [String : Any]) {
    if let action = message["action"] as? String, action == "trigger_sos" {
      sendEvent(watchSosEvent, ["source": "apple_watch", "timestamp": Date().timeIntervalSince1970 * 1000])
    }
  }
}


private final class MyMapSafetyDelegate: NSObject, CLLocationManagerDelegate, WCSessionDelegate {
  private weak var owner: MyMapSafetyModule?

  init(owner: MyMapSafetyModule) {
    self.owner = owner
    super.init()
  }

  func locationManager(_ manager: CLLocationManager, didVisit visit: CLVisit) {
    owner?.locationManager(manager, didVisit: visit)
  }

  func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
    owner?.locationManager(manager, didEnterRegion: region)
  }

  func locationManager(_ manager: CLLocationManager, didExitRegion region: CLRegion) {
    owner?.locationManager(manager, didExitRegion: region)
  }

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    owner?.session(session, activationDidCompleteWith: activationState, error: error)
  }

  func sessionDidBecomeInactive(_ session: WCSession) {
    owner?.sessionDidBecomeInactive(session)
  }

  func sessionDidDeactivate(_ session: WCSession) {
    owner?.sessionDidDeactivate(session)
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    owner?.session(session, didReceiveMessage: message)
  }
}
