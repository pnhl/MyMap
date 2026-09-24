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
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val wasTracking = prefs.getBoolean(KEY_TRACKING_ACTIVE, false)
            if (wasTracking) {
                Log.i(TAG, "Tracking was previously active. Re-launching foreground service...")
                val serviceIntent = Intent(context, MyMapForegroundService::class.java).apply {
                    this.action = MyMapForegroundService.ACTION_START_TRACKING
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent)
                } else {
                    context.startService(serviceIntent)
                }
            }
        }
    }
}
