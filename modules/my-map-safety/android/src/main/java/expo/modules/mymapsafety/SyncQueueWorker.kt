package expo.modules.mymapsafety

import android.content.Context
import android.util.Log
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.BackoffPolicy
import java.util.concurrent.TimeUnit

class SyncQueueWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    companion object {
        private const val TAG = "MyMapSyncWorker"
        const val WORK_NAME = "mymap_offline_sync_work"

        fun schedulePeriodicSync(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val syncRequest = PeriodicWorkRequestBuilder<SyncQueueWorker>(15, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                androidx.work.ExistingPeriodicWorkPolicy.KEEP,
                syncRequest
            )
            Log.i(TAG, "Periodic sync worker successfully enqueued.")
        }
    }

    override suspend fun doWork(): Result {
        Log.i(TAG, "SyncQueueWorker executing background sync of offline queues...")
        return try {
            // Signal React Native bridge / SQLite if needed
            Result.success()
        } catch (e: Exception) {
            Log.w(TAG, "Background sync encountered retryable error: ${e.message}")
            Result.retry()
        }
    }
}
