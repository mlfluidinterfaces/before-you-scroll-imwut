package com.fluidinterfaces.screentimeApp

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.work.WorkManager

class DeviceShutdownReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_SHUTDOWN, Intent.ACTION_REBOOT -> {
                Log.d("DeviceShutdownReceiver", "Device shutdown/reboot detected - stopping hourly collection")
                
                try {
                    // Cancel the periodic work
                    WorkManager.getInstance(context).cancelUniqueWork("usage_stats_worker")
                    
                    // Update the running state in SharedPreferences
                    val sharedPrefs = context.getSharedPreferences("ScreenTimePrefs", Context.MODE_PRIVATE)
                    sharedPrefs.edit().putBoolean("workmanager_running", false).apply()
                    
                    Log.d("DeviceShutdownReceiver", "Successfully stopped hourly collection")
                } catch (e: Exception) {
                    Log.e("DeviceShutdownReceiver", "Error stopping hourly collection on shutdown", e)
                }
            }
        }
    }
}
