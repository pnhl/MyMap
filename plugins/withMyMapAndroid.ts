import { mkdirSync, writeFileSync, readFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type ConfigPlugin,
  withAndroidManifest,
  withAndroidStyles,
  withAppBuildGradle,
  withDangerousMod,
  withMainApplication,
  withGradleProperties,
  withProjectBuildGradle,
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
import com.amazon.device.ads.AdRegistration
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

  @ReactMethod
  fun initializeAmazonAds(appId: String, promise: Promise) {
    if (appId.isBlank()) {
      promise.resolve(false)
      return
    }
    runCatching {
      AdRegistration.getInstance(appId, context.applicationContext)
    }.onSuccess {
      promise.resolve(true)
    }.onFailure { error ->
      promise.reject("ERR_AMAZON_ADS_INIT", "Không thể khởi tạo Amazon Publisher Services.", error)
    }
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

const NETWORK_SECURITY_SOURCE = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false" />
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="false">127.0.0.1</domain>
    <domain includeSubdomains="false">localhost</domain>
  </domain-config>
</network-security-config>
`;

const withMyMapAndroid: ConfigPlugin = config => {
  config=withGradleProperties(config,mod=>{mod.modResults=mod.modResults.filter(item=>item.type!=='property'||!['android.kotlinVersion','expo.enableCompileTimeOptimization'].includes(item.key));mod.modResults.push({type:'property',key:'android.kotlinVersion',value:'2.3.20'});return mod;});
  config=withProjectBuildGradle(config,mod=>{mod.modResults.contents=mod.modResults.contents.replace(/classpath\('org.jetbrains.kotlin:kotlin-gradle-plugin(?::[^']+)?'\)/,"classpath('org.jetbrains.kotlin:kotlin-gradle-plugin:2.3.20')");return mod;});
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
    manifest['uses-permission'] ??= [];
    // Expo TaskManager creates persisted location jobs; Android requires this normal permission.
    for (const name of ['android.permission.RECEIVE_BOOT_COMPLETED', 'android.permission.WAKE_LOCK', 'android.permission.FOREGROUND_SERVICE_SPECIAL_USE', 'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK', 'android.permission.MODIFY_AUDIO_SETTINGS']) {
      if (!manifest['uses-permission'].some(item => item.$['android:name'] === name)) manifest['uses-permission'].push({$: {'android:name': name}});
    }
    const application = manifest.application?.[0];
    if (application) {
      application.receiver ??= [];
      const momentReceiver={
        $:{'android:name':'.MomentWidget','android:exported':'false' as const},
        'intent-filter':[{action:[{$:{'android:name':'android.appwidget.action.APPWIDGET_UPDATE'}}]}],
        'meta-data':[{$:{'android:name':'android.appwidget.provider','android:resource':'@xml/mymap_moment_widget_info'}}],
      };
      if(!application.receiver.some(item=>item.$['android:name']==='.MomentWidget')) application.receiver.push(momentReceiver);
      const momentApplication=application as typeof application & {provider?:Array<{$:Record<string,string>;'meta-data':Array<{$:Record<string,string>}>}>};
      momentApplication.provider ??= [];
      if(!momentApplication.provider.some(item=>item.$['android:authorities']==='com.pnhl.vibecoding.moments.files')) momentApplication.provider.push({
        $:{'android:name':'androidx.core.content.FileProvider','android:authorities':'com.pnhl.vibecoding.moments.files','android:exported':'false','android:grantUriPermissions':'true'},
        'meta-data':[{$:{'android:name':'android.support.FILE_PROVIDER_PATHS','android:resource':'@xml/mymap_moment_files'}}],
      });
      application.$['android:networkSecurityConfig'] = '@xml/mymap_network_security_config';
      application.service ??= [];
      for (const [name, type] of [['.SafetyMonitorService', 'specialUse'], ['.PlatformTrackingService', 'location']] as const) {
        if (!application.service.some(item => item.$['android:name'] === name)) application.service.push({$: {'android:name': name, 'android:exported': 'false', 'android:foregroundServiceType': type}, ...(type === 'specialUse' ? {property: [{$: {'android:name': 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE', 'android:value': 'User-enabled crash and high fall sensor monitoring with inactivity alert'}}]} : {})});
      }
      if (!application.service.some(item => item.$['android:name'] === 'expo.modules.audio.service.AudioControlsService')) {
        application.service.push({
          $: {'android:name': 'expo.modules.audio.service.AudioControlsService', 'android:exported': 'false', 'android:foregroundServiceType': 'mediaPlayback'},
          'intent-filter': [{action: [{$: {'android:name': 'androidx.media3.session.MediaSessionService'}}]}],
        });
      }
      application['meta-data'] ??= [];
      if (!application['meta-data'].some(item => item.$['android:name'] === 'com.amazon.appstore.APP_ID')) application['meta-data'].push({$: {'android:name': 'com.amazon.appstore.APP_ID', 'android:value': 'amzn1.devportal.mobileapp.5da38626eb454bfcb8403c32d2a1e1c5'}});
    }
    manifest.queries ??= [];
    for (const packageName of ['oss.krtirtho.spotube', 'oss.krtirtho.spotube.nightly', 'oss.krtirtho.spotube.dev']) {
      if (!manifest.queries.some(item => item.package?.some(query => query.$['android:name'] === packageName))) {
        manifest.queries.push({package: [{$: {'android:name': packageName}}]});
      }
    }
    if (!manifest.queries.some(item => item.intent?.some(intent => intent.action?.some(action => action.$['android:name'] === 'android.intent.action.DIAL')))) manifest.queries.push({intent: [{action: [{$: {'android:name': 'android.intent.action.DIAL'}}], data: [{$: {'android:scheme': 'tel'}}]}]});
    return mod;
  });

  config = withAppBuildGradle(config, mod => {
    if (mod.modResults.language !== 'groovy') return mod;
    let source = mod.modResults.contents;
    // Development flavors load JavaScript from Metro; release flavors still bundle Hermes.
    source = source.replace(/^[ \t]*(?:\/\/\s*)?debuggableVariants\s*=\s*\[[^\]]*\]/m, '    debuggableVariants = ["googleDebug", "amazonDebug"]');
    if(!source.includes('media3-transformer'))source=source.replace('dependencies {','dependencies {\n    implementation("androidx.media3:media3-transformer:1.9.0")\n    implementation("androidx.media3:media3-effect:1.9.0")\n    implementation("androidx.work:work-runtime-ktx:2.11.1")');
    if(!source.includes('// MyMap: changing public build configuration')){
      source+=`\n// MyMap: changing public build configuration must regenerate the embedded bundle.
tasks.withType(com.facebook.react.tasks.BundleHermesCTask).configureEach {
    inputs.property('mymapTestAds', providers.environmentVariable('EXPO_PUBLIC_ENABLE_TEST_ADS').orElse('false'))
    inputs.files(rootProject.file('../.env').exists() ? [rootProject.file('../.env')] : [])
    extraPackagerArgs.add('--reset-cache')
}\n`;
    }
    if (!source.includes('com.amazon.android:aps-sdk:12.0.1')) {
      source = source.replace(
        'implementation("com.facebook.react:react-android")',
        `implementation("com.facebook.react:react-android")

    // Amazon Publisher Services demand + the official Google Mobile Ads adapter.
    // Initialization remains dormant until EXPO_PUBLIC_AMAZON_APS_APP_ID is set.
    implementation("com.amazon.android:aps-sdk:12.0.1")
    ${(process.env.APP_STORE_TARGET||process.env.MYMAP_STORE)==='amazon'?'':'googleImplementation("com.amazon.android:aps-admob-adapter:6.0.0")'}`,
      );
    }
    if (process.env.EAS_BUILD!=='true' && !source.includes("rootProject.file('../.signing/' + (System.getenv('APP_STORE_TARGET') ?: System.getenv('MYMAP_STORE') ?: 'play') + '/release.properties')")) {
      source = source.replace(
        /signingConfigs \{\s*debug \{([\s\S]*?)\n\s*\}\s*\}/,
        `signingConfigs {
        debug {$1
        }
        release {
            def releasePropertiesFile = rootProject.file('../.signing/' + (System.getenv('APP_STORE_TARGET') ?: System.getenv('MYMAP_STORE') ?: 'play') + '/release.properties')
            if (gradle.startParameter.taskNames.any { it.toLowerCase().contains('release') && (it.contains('assemble') || it.contains('bundle') || it.contains('sign')) } && releasePropertiesFile.exists()) {
            def releaseProperties = new Properties()
            releasePropertiesFile.withInputStream { releaseProperties.load(it) }
            storeFile file(releaseProperties['storeFile'])
            storePassword releaseProperties['storePassword']
            keyAlias releaseProperties['keyAlias']
            keyPassword releaseProperties['keyPassword']
            }
        }
    }`,
      );
      source = source.replace(
        /release \{\s*\/\/ Caution![\s\S]*?signingConfig signingConfigs\.debug/,
        `release {
            signingConfig signingConfigs.release`,
      );
    }
    if (!source.includes('flavorDimensions "distribution"')) {
      source = source.replace('    signingConfigs {', readFileSync(join(__dirname, 'native', 'flavors.gradle'), 'utf8') + '\n    signingConfigs {');
    }
    if (!source.includes('amazon-appstore-sdk')) {
      source = source.replace('dependencies {', 'dependencies {\n    googleImplementation("com.google.android.gms:play-services-wearable:20.0.1")\n    googleImplementation("androidx.car.app:app:1.7.0")\n    googleImplementation("androidx.car.app:app-projected:1.7.0")\n    googleImplementation("org.maplibre.gl:android-sdk-opengl:13.6.1")\n    amazonImplementation("com.amazon.device:amazon-appstore-sdk:3.0.9")');
    }
    if (!source.includes('MyMap dependency lock contract')) source += '\n// MyMap dependency lock contract\ndependencyLocking { lockAllConfigurations() }\n';
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
    const xmlDir = join(projectRoot, 'app', 'src', 'main', 'res', 'xml');
    mkdirSync(packageDir, { recursive: true });
    mkdirSync(drawableDir, { recursive: true });
    mkdirSync(xmlDir, { recursive: true });
    writeFileSync(join(xmlDir, 'mymap_network_security_config.xml'), NETWORK_SECURITY_SOURCE);
    const debugXmlDir = join(projectRoot, 'app/src/debug/res/xml');
    mkdirSync(debugXmlDir, {recursive: true});
    writeFileSync(join(debugXmlDir, 'mymap_network_security_config.xml'), NETWORK_SECURITY_SOURCE.replace('  </domain-config>', '    <domain includeSubdomains="false">10.0.2.2</domain>\n  </domain-config>'));
    writeFileSync(join(packageDir, 'PlatformLocationModule.kt'), MODULE_SOURCE);
    writeFileSync(join(packageDir, 'PlatformLocationPackage.kt'), PACKAGE_SOURCE);
    writeFileSync(join(drawableDir, 'splash_screen.xml'), SPLASH_SOURCE);
    for (const file of ['PlatformLocationModule.kt', 'PlatformLocationPackage.kt', 'TravelPlatformModule.kt', 'SafetyMonitorService.kt', 'PlatformTrackingService.kt', 'PlaceRegionRecorder.kt', 'MomentPlatformModule.kt','MomentWidget.kt','MomentWidgetWorker.java','MyMapPushModule.kt']) {
      copyFileSync(join(__dirname, 'native', file), join(packageDir, file));
    }
    mkdirSync(join(projectRoot,'app','src','main','res','layout'),{recursive:true});
    copyFileSync(join(__dirname,'native','mymap_moment_widget.xml'),join(projectRoot,'app','src','main','res','layout','mymap_moment_widget.xml'));
    for(const file of ['mymap_moment_widget_info.xml','mymap_moment_files.xml'])copyFileSync(join(__dirname,'native',file),join(xmlDir,file));
    copyFileSync(join(__dirname,'native','mymap_widget_background.xml'),join(drawableDir,'mymap_widget_background.xml'));
    const googleRoot = join(projectRoot, 'app', 'src', 'google');
    const carPackage = join(googleRoot, 'java', 'com', 'pnhl', 'vibecoding');
    mkdirSync(carPackage, { recursive: true });
    mkdirSync(join(googleRoot, 'res', 'xml'), { recursive: true });
    copyFileSync(join(__dirname, 'native', 'MyMapCarService.kt'), join(carPackage, 'MyMapCarService.kt'));
    copyFileSync(join(__dirname, 'native', 'MyMapWearBridge.kt'), join(carPackage, 'MyMapWearBridge.kt'));
    mkdirSync(join(googleRoot,'res','values'),{recursive:true});
    writeFileSync(join(googleRoot,'res','values','wear.xml'),'<resources><string-array name="android_wear_capabilities"><item>mymap_phone</item></string-array></resources>');
    copyFileSync(join(__dirname, 'native', 'google-manifest.xml'), join(googleRoot, 'AndroidManifest.xml'));
    copyFileSync(join(__dirname, 'native', 'automotive_app_desc.xml'), join(googleRoot, 'res', 'xml', 'automotive_app_desc.xml'));
    const proguard = join(projectRoot, 'app', 'proguard-rules.pro');
    let rules = readFileSync(proguard, 'utf8');
    if(!rules.includes('-keep class com.pnhl.vibecoding.MyMapWearBridge'))rules+='\n-keep class com.pnhl.vibecoding.MyMapWearBridge { *; }\n';
    // The prefixed WebRTC AAR loads this namespace from JNI_OnLoad. Its upstream
    // org.jni_zero rule does not cover livekit.org.jni_zero, so R8 strips JniInit.
    if (!rules.includes('-keep class livekit.org.jni_zero.**')) rules += '\n# Preserve LiveKit-prefixed JNI registration in optimized release builds.\n-keep class livekit.org.jni_zero.** { *; }\n';
    // AppLoaderProvider resolves this class from manifest metadata via reflection.
    if (!rules.includes('-keep class expo.modules.adapters.react.apploader.RNHeadlessAppLoader')) rules += '\n# Preserve the manifest-selected Expo background task loader.\n-keep class expo.modules.adapters.react.apploader.RNHeadlessAppLoader { *; }\n';
    if (!rules.includes('com.rnllama.')) rules += '\n# Preserve the local AI JNI entry points in release builds.\n-keep class com.rnllama.** { *; }\n';
    if (!rules.includes('MyMap widget uses')) rules += '\n# MyMap widget uses the public native auth API without reading Kotlin 2.3 metadata.\n-keep class com.google.firebase.auth.FirebaseAuth { public static *** getInstance(); public *** getCurrentUser(); }\n-keep class com.google.firebase.auth.FirebaseUser { public *** getUid(); public *** isAnonymous(); public *** getIdToken(boolean); }\n-keep class com.google.firebase.auth.GetTokenResult { public *** getToken(); }\n-keep class com.google.android.gms.tasks.Tasks { public static *** await(...); }\n-keep class com.google.android.gms.tasks.Task\n';
    if (!rules.includes('com.amazon.device.drm')) rules += '\n-keep class com.amazon.device.iap.** { *; }\n-keep class com.amazon.device.drm.** { *; }\n-keep class com.amazon.venezia.** { *; }\n-keep class com.amazon.a.** { *; }\n-dontwarn com.amazon.**\n';
    writeFileSync(proguard,rules);

    return mod;
  }]);
};

export default withMyMapAndroid;
