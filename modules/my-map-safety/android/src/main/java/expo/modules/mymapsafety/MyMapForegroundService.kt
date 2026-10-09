package expo.modules.mymapsafety

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

class MyMapForegroundService : Service() {

    companion object {
        const val CHANNEL_ID = "mymap_tracking_channel"
        const val NOTIFICATION_ID = 1001

        const val ACTION_START_TRACKING = "expo.modules.mymapsafety.ACTION_START"
        const val ACTION_STOP_TRACKING = "expo.modules.mymapsafety.ACTION_STOP"
        const val ACTION_PAUSE_TRACKING = "expo.modules.mymapsafety.ACTION_PAUSE"
        const val ACTION_RESUME_TRACKING = "expo.modules.mymapsafety.ACTION_RESUME"
        const val ACTION_QUICK_SNAP = "expo.modules.mymapsafety.ACTION_QUICK_SNAP"
        const val ACTION_EMERGENCY_SOS = "expo.modules.mymapsafety.ACTION_SOS"

        @Volatile
        var isPaused: Boolean = false
            private set
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP_TRACKING -> {
                saveTrackingState(false)
                stopForeground(true)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_PAUSE_TRACKING -> {
                isPaused = true
                updateNotification("Đang tạm dừng ghi hành trình")
            }
            ACTION_RESUME_TRACKING -> {
                isPaused = false
                updateNotification("Đang ghi lại hành trình MyMap")
            }
            ACTION_QUICK_SNAP -> {
                launchAppWithAction("snap")
            }
            ACTION_EMERGENCY_SOS -> {
                launchAppWithAction("sos")
            }
            else -> {
                saveTrackingState(true)
                startForeground(NOTIFICATION_ID, buildNotification("Đang chủ động ghi hành trình MyMap"))
            }
        }
        return START_STICKY
    }

    private fun saveTrackingState(active: Boolean) {
        val prefs = getSharedPreferences(BootReceiver.PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putBoolean(BootReceiver.KEY_TRACKING_ACTIVE, active).apply()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Theo dõi hành trình MyMap",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Hiển thị thông báo trạng thái ghi hành trình nền và điều khiển nhanh"
                setShowBadge(false)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(statusText: String): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val contentPendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val pauseResumeIntent = Intent(this, MyMapForegroundService::class.java).apply {
            action = if (isPaused) ACTION_RESUME_TRACKING else ACTION_PAUSE_TRACKING
        }
        val pauseResumePendingIntent = PendingIntent.getService(
            this,
            1,
            pauseResumeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val snapIntent = Intent(this, MyMapForegroundService::class.java).apply {
            action = ACTION_QUICK_SNAP
        }
        val snapPendingIntent = PendingIntent.getService(
            this,
            2,
            snapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val sosIntent = Intent(this, MyMapForegroundService::class.java).apply {
            action = ACTION_EMERGENCY_SOS
        }
        val sosPendingIntent = PendingIntent.getService(
            this,
            3,
            sosIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("MyMap Đang Hoạt Động")
            .setContentText(statusText)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentIntent(contentPendingIntent)
            .setOngoing(true)
            .addAction(
                if (isPaused) android.R.drawable.ic_media_play else android.R.drawable.ic_media_pause,
                if (isPaused) "Tiếp tục" else "Tạm dừng",
                pauseResumePendingIntent
            )
            .addAction(
                android.R.drawable.ic_menu_camera,
                "Chụp nhanh",
                snapPendingIntent
            )
            .addAction(
                android.R.drawable.ic_dialog_alert,
                "SOS Khẩn cấp",
                sosPendingIntent
            )

        return builder.build()
    }

    private fun updateNotification(statusText: String) {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, buildNotification(statusText))
    }

    private fun launchAppWithAction(extraAction: String) {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("mymap_action", extraAction)
        }
        if (launchIntent != null) {
            startActivity(launchIntent)
        }
    }
}
