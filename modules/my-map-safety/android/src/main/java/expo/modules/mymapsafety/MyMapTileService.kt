package expo.modules.mymapsafety

import android.content.Context
import android.content.Intent
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import androidx.annotation.RequiresApi

@RequiresApi(Build.VERSION_CODES.N)
class MyMapTileService : TileService() {

    override fun onStartListening() {
        super.onStartListening()
        updateTileState()
    }

    override fun onClick() {
        super.onClick()
        val tile = qsTile ?: return
        val prefs = getSharedPreferences(BootReceiver.PREFS_NAME, Context.MODE_PRIVATE)
        val currentlyActive = prefs.getBoolean(BootReceiver.KEY_TRACKING_ACTIVE, false)
        val nextActive = !currentlyActive

        prefs.edit().putBoolean(BootReceiver.KEY_TRACKING_ACTIVE, nextActive).apply()

        val serviceIntent = Intent(this, MyMapForegroundService::class.java).apply {
            action = if (nextActive) MyMapForegroundService.ACTION_START_TRACKING else MyMapForegroundService.ACTION_STOP_TRACKING
        }

        if (nextActive) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent)
            } else {
                startService(serviceIntent)
            }
        } else {
            startService(serviceIntent)
        }

        updateTileState()
    }

    private fun updateTileState() {
        val tile = qsTile ?: return
        val prefs = getSharedPreferences(BootReceiver.PREFS_NAME, Context.MODE_PRIVATE)
        val isActive = prefs.getBoolean(BootReceiver.KEY_TRACKING_ACTIVE, false)

        tile.state = if (isActive) Tile.STATE_ACTIVE else Tile.STATE_INACTIVE
        tile.label = if (isActive) "MyMap: Đang ghi" else "MyMap: Tắt"
        tile.contentDescription = "Chạm để bật hoặc tắt ghi hành trình MyMap"
        tile.updateTile()
    }
}
