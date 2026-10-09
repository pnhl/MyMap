package expo.modules.mymapsafety

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

class BootReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "MyMapBootReceiver"
        const val PREFS_NAME = "mymap_tracking_prefs"
        const val KEY_TRACKING_ACTIVE = "tracking_active"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action == Intent.ACTION_BOOT_COMPLETED || action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            Log.i(TAG, "Device rebooted or package replaced ($action). Checking tracking state...")
            val prefs = context.getSharedPreferences("mymap_travel", Context.MODE_PRIVATE)
            val wasTracking = prefs.getBoolean("platform_tracking", false)
            if (wasTracking) {
                Log.i(TAG, "Tracking was previously active. Re-launching foreground service...")
                val permission=androidx.core.content.ContextCompat.checkSelfPermission(context,android.Manifest.permission.ACCESS_FINE_LOCATION)==android.content.pm.PackageManager.PERMISSION_GRANTED
                val background=Build.VERSION.SDK_INT<29||androidx.core.content.ContextCompat.checkSelfPermission(context,android.Manifest.permission.ACCESS_BACKGROUND_LOCATION)==android.content.pm.PackageManager.PERMISSION_GRANTED
                if(!permission||!background)return
                val serviceIntent=Intent().setClassName(context.packageName,context.packageName+".PlatformTrackingService")
                try{if(Build.VERSION.SDK_INT>=26)context.startForegroundService(serviceIntent)else context.startService(serviceIntent)}
                catch(_:Exception){prefs.edit().putString("platform_error","Mở MyMap để khôi phục ghi hành trình sau khi khởi động lại.").apply()}
            }
        }
    }
}
