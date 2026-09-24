import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type ConfigPlugin,
  withAndroidManifest,
  withAndroidStyles,
  withAppBuildGradle,
  withDangerousMod,
  withMainApplication,
} from '@expo/config-plugins';

const MODULE_SOURCE = `package com.pnhl.vibecoding

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.Looper
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class PlatformLocationModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context), LocationListener {
  private val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
  private var listening = false

  override fun getName() = "PlatformLocation"

  @ReactMethod
  fun isAmazonDevice(promise: Promise) {
    val signature = listOf(Build.MANUFACTURER, Build.BRAND, Build.MODEL)
      .joinToString(" ")
      .lowercase()
    promise.resolve(signature.contains("amazon") || signature.contains("kindle"))
  }

  private fun hasLocationPermission(): Boolean =
    ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
      ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

  private fun enabledProviders(): List<String> =
    listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
      .filter { runCatching { locationManager.isProviderEnabled(it) }.getOrDefault(false) }

  private fun locationMap(location: Location) = Arguments.createMap().apply {
    putDouble("latitude", location.latitude)
    putDouble("longitude", location.longitude)
    putDouble("accuracy", location.accuracy.toDouble())
    if (location.hasAltitude()) putDouble("altitude", location.altitude) else putNull("altitude")
    if (location.hasSpeed()) putDouble("speed", location.speed.toDouble()) else putNull("speed")
    if (location.hasBearing()) putDouble("heading", location.bearing.toDouble()) else putNull("heading")
    putDouble("timestamp", location.time.toDouble())
  }

  @SuppressLint("MissingPermission")
  @ReactMethod
  fun getCurrentPosition(promise: Promise) {
    if (!hasLocationPermission()) {
      promise.reject("ERR_LOCATION_PERMISSION", "Quyền vị trí chưa được cấp.")
      return
    }
    val providers = enabledProviders()
    if (providers.isEmpty()) {
      promise.reject("ERR_LOCATION_DISABLED", "GPS/Location đang tắt.")
      return
    }
    val latest = providers.mapNotNull { provider ->
      runCatching { locationManager.getLastKnownLocation(provider) }.getOrNull()
    }.maxByOrNull { it.time }
    if (latest != null && System.currentTimeMillis() - latest.time <= 120_000) {
      promise.resolve(locationMap(latest))
      return
    }

    val provider = providers.first()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      locationManager.getCurrentLocation(provider, null, context.mainExecutor) { location ->
        if (location != null) promise.resolve(locationMap(location))
        else promise.reject("ERR_LOCATION_UNAVAILABLE", "Không nhận được vị trí hiện tại.")
      }
    } else {
      val listener = object : LocationListener {
        override fun onLocationChanged(location: Location) = promise.resolve(locationMap(location))
        override fun onProviderDisabled(provider: String) = Unit
        override fun onProviderEnabled(provider: String) = Unit
        @Deprecated("Deprecated in Android")
        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit
      }
      locationManager.requestSingleUpdate(provider, listener, Looper.getMainLooper())
    }
  }

  @SuppressLint("MissingPermission")
  @ReactMethod
  fun startUpdates(intervalMs: Double, distanceMeters: Double, promise: Promise) {
    if (!hasLocationPermission()) {
      promise.reject("ERR_LOCATION_PERMISSION", "Quyền vị trí chưa được cấp.")
      return
    }
    val providers = enabledProviders()
    if (providers.isEmpty()) {
      promise.reject("ERR_LOCATION_DISABLED", "GPS/Location đang tắt.")
      return
    }
    stopNativeUpdates()
    providers.forEach { provider ->
      locationManager.requestLocationUpdates(
        provider,
        intervalMs.toLong().coerceAtLeast(1_000L),
        distanceMeters.toFloat().coerceAtLeast(0f),
        this,
        Looper.getMainLooper(),
      )
    }
    listening = true
    promise.resolve(true)
  }

  @ReactMethod
  fun stopUpdates(promise: Promise) {
    stopNativeUpdates()
    promise.resolve(true)
  }

  override fun onLocationChanged(location: Location) {
    if (!context.hasActiveReactInstance()) return
    context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("platformLocation", locationMap(location))
  }

  override fun onProviderDisabled(provider: String) = Unit
  override fun onProviderEnabled(provider: String) = Unit
  @Deprecated("Deprecated in Android")
  override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit

  @ReactMethod fun addListener(eventName: String) = Unit
  @ReactMethod fun removeListeners(count: Double) = Unit

  private fun stopNativeUpdates() {
    if (listening) locationManager.removeUpdates(this)
    listening = false
  }

  override fun invalidate() {
    stopNativeUpdates()
    super.invalidate()
  }
}
`;

const PACKAGE_SOURCE = `package com.pnhl.vibecoding

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class PlatformLocationPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(PlatformLocationModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
`;

const SPLASH_SOURCE = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
  <item android:drawable="@color/splashscreen_background" />
  <item android:gravity="center" android:drawable="@drawable/splashscreen_logo" />
</layer-list>
`;

const withMyMapAndroid: ConfigPlugin = config => {
  config = withAndroidManifest(config, mod => {
    const manifest = mod.modResults.manifest;
    manifest['uses-feature'] ??= [];
    const optionalFeatures = [
      'android.hardware.location',
      'android.hardware.location.gps',
      'android.hardware.location.network',
      'android.hardware.camera',
      'android.hardware.camera.autofocus',
    ];
    for (const featureName of optionalFeatures) {
      const existing = manifest['uses-feature'].find(
        feature => feature.$['android:name'] === featureName,
      );
      if (existing) {
        existing.$['android:required'] = 'false';
      } else {
        manifest['uses-feature'].push({
          $: {
            'android:name': featureName,
            'android:required': 'false',
          },
        });
      }
    }
    return mod;
  });

  config = withAppBuildGradle(config, mod => {
    if (mod.modResults.language !== 'groovy') return mod;
    let source = mod.modResults.contents;
    if (!source.includes("rootProject.file('../.signing/release.properties')")) {
      source = source.replace(
        /signingConfigs \{\s*debug \{([\s\S]*?)\n\s*\}\s*\}/,
        `signingConfigs {
        debug {$1
        }
        release {
            def releasePropertiesFile = rootProject.file('../.signing/release.properties')
            if (!releasePropertiesFile.exists()) {
                throw new GradleException('Missing MyMap release signing files in .signing/')
            }
            def releaseProperties = new Properties()
            releasePropertiesFile.withInputStream { releaseProperties.load(it) }
            storeFile file(releaseProperties['storeFile'])
            storePassword releaseProperties['storePassword']
            keyAlias releaseProperties['keyAlias']
            keyPassword releaseProperties['keyPassword']
        }
    }`,
      );
      source = source.replace(
        /release \{\s*\/\/ Caution![\s\S]*?signingConfig signingConfigs\.debug/,
        `release {
            signingConfig signingConfigs.release`,
      );
    }
    mod.modResults.contents = source;
    return mod;
  });

  config = withMainApplication(config, mod => {
    if (!mod.modResults.contents.includes('add(PlatformLocationPackage())')) {
      mod.modResults.contents = mod.modResults.contents.replace(
        '// add(MyReactNativePackage())',
        '// add(MyReactNativePackage())\n          add(PlatformLocationPackage())',
      );
    }
    return mod;
  });

  config = withAndroidStyles(config, mod => {
    type StyleItem = { $: { name: string }; _?: string };
    type Style = { $: { name: string }; item?: StyleItem[] };
    const styles = (mod.modResults.resources.style ?? []) as Style[];
    const appTheme = styles.find(style => style.$.name === 'AppTheme');
    if (appTheme) {
      appTheme.item ??= [];
      const windowBackground = appTheme.item.find(item => item.$.name === 'android:windowBackground');
      if (windowBackground) {
        windowBackground._ = '@drawable/splash_screen';
      } else {
        appTheme.item.push({ $: { name: 'android:windowBackground' }, _: '@drawable/splash_screen' });
      }
    }
    return mod;
  });

  return withDangerousMod(config, ['android', mod => {
    const projectRoot = mod.modRequest.platformProjectRoot;
    const packageDir = join(projectRoot, 'app', 'src', 'main', 'java', 'com', 'pnhl', 'vibecoding');
    const drawableDir = join(projectRoot, 'app', 'src', 'main', 'res', 'drawable');
    mkdirSync(packageDir, { recursive: true });
    mkdirSync(drawableDir, { recursive: true });
    writeFileSync(join(packageDir, 'PlatformLocationModule.kt'), MODULE_SOURCE);
    writeFileSync(join(packageDir, 'PlatformLocationPackage.kt'), PACKAGE_SOURCE);
    writeFileSync(join(drawableDir, 'splash_screen.xml'), SPLASH_SOURCE);

    return mod;
  }]);
};

export default withMyMapAndroid;
