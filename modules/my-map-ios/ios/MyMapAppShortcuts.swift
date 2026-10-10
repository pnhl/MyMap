import AppIntents
import Foundation

@available(iOS 16.4, *)
struct MyMapSOSIntent: AppIntent {
  static var title: LocalizedStringResource = "Mở SOS MyMap"
  static var description = IntentDescription("Mở MyMap để bạn xác nhận SOS. Không tự gọi điện hoặc gửi cảnh báo.")
  static var openAppWhenRun: Bool = true
  @MainActor func perform() async throws -> some IntentResult {
    UserDefaults.standard.set("mymap.sos",forKey:"mymap.quick-action")
    NotificationCenter.default.post(name:Notification.Name("MyMapQuickAction"),object:nil)
    return .result()
  }
}
@available(iOS 16.4, *)
struct MyMapTrackingIntent: AppIntent {
  static var title: LocalizedStringResource = "Mở ghi hành trình MyMap"
  static var openAppWhenRun: Bool = true
  @MainActor func perform() async throws -> some IntentResult {
    UserDefaults.standard.set("mymap.smart",forKey:"mymap.quick-action")
    NotificationCenter.default.post(name:Notification.Name("MyMapQuickAction"),object:nil)
    return .result()
  }
}
@available(iOS 16.4, *)
struct MyMapAppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(intent:MyMapSOSIntent(),phrases:["Mở SOS trong \(.applicationName)"],shortTitle:"Mở SOS",systemImageName:"sos")
    AppShortcut(intent:MyMapTrackingIntent(),phrases:["Mở hành trình trong \(.applicationName)"],shortTitle:"Ghi hành trình",systemImageName:"location")
  }
}
