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
        val prefs = getSharedPreferences("mymap_travel", Context.MODE_PRIVATE)
        val currentlyActive = prefs.getBoolean("tracking_indicator", false)
        val nextActive = !currentlyActive

        prefs.edit().putString("tracking_shortcut",if(nextActive) "start" else "stop").commit()
        val launch=Intent(Intent.ACTION_VIEW,android.net.Uri.parse("mymap://smart")).setPackage(packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        val pending=android.app.PendingIntent.getActivity(this,101,launch,android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE)
        if(Build.VERSION.SDK_INT>=34)startActivityAndCollapse(pending) else {
            @Suppress("DEPRECATION")
            startActivityAndCollapse(launch)
        }

        updateTileState()
    }

    private fun updateTileState() {
        val tile = qsTile ?: return
        val prefs = getSharedPreferences("mymap_travel", Context.MODE_PRIVATE)
        val isActive = prefs.getBoolean("tracking_indicator", false)

        tile.state = if (isActive) Tile.STATE_ACTIVE else Tile.STATE_INACTIVE
        tile.label = if (isActive) "MyMap: Đang ghi" else "MyMap: Tắt"
        tile.contentDescription = "Chạm để bật hoặc tắt ghi hành trình MyMap"
        tile.updateTile()
    }
}
