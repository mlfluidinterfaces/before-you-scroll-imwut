package com.fluidinterfaces.screentimeApp

import android.app.usage.UsageStatsManager
import android.view.accessibility.AccessibilityManager
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.app.AppOpsManager
import android.util.Log
import androidx.work.*
import com.facebook.react.bridge.*
import java.util.concurrent.TimeUnit

class ScreenTimeModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private val context = reactContext

    override fun getName(): String {
        return "ScreenTimeModule"
    }

    @ReactMethod
    fun setUserUuid(uuid: String, promise: Promise) {
        try {
            val sharedPrefs = context.getSharedPreferences("ScreenTimePrefs", Context.MODE_PRIVATE)
            sharedPrefs.edit().putString("user_uuid", uuid).apply()

            promise.resolve("UUID stored successfully")
            Log.d("ScreenTimeModule", "User UUID stored: $uuid")
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to store UUID: ${e.message}")
            Log.e("ScreenTimeModule", "Error storing UUID", e)
        }
    }

    @ReactMethod
    fun getUserUuid(promise: Promise) {
        try {
            val sharedPrefs = context.getSharedPreferences("ScreenTimePrefs", Context.MODE_PRIVATE)
            val uuid = sharedPrefs.getString("user_uuid", null)

            if (uuid != null) {
                promise.resolve(uuid)
                Log.d("ScreenTimeModule", "Retrieved UUID: $uuid")
            } else {
                promise.reject("NOT_FOUND", "UUID not found in SharedPreferences")
                Log.w("ScreenTimeModule", "UUID not found in SharedPreferences")
            }
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to retrieve UUID: ${e.message}")
            Log.e("ScreenTimeModule", "Error retrieving UUID", e)
        }
    }

    @ReactMethod
    fun setUserId(userId: String, promise: Promise) {
        try {
            val sharedPrefs = context.getSharedPreferences("ScreenTimePrefs", Context.MODE_PRIVATE)
            sharedPrefs.edit().putString("user_id", userId).apply()

            promise.resolve("User ID stored successfully")
            Log.d("ScreenTimeModule", "User ID stored: $userId")
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to store User ID: ${e.message}")
            Log.e("ScreenTimeModule", "Error storing User ID", e)
        }
    }

    @ReactMethod
    fun getUserId(promise: Promise) {
        try {
            val sharedPrefs = context.getSharedPreferences("ScreenTimePrefs", Context.MODE_PRIVATE)
            val userId = sharedPrefs.getString("user_id", null)

            if (userId != null) {
                promise.resolve(userId)
                Log.d("ScreenTimeModule", "Retrieved User ID: $userId")
            } else {
                promise.reject("NOT_FOUND", "User ID not found in SharedPreferences")
                Log.w("ScreenTimeModule", "User ID not found in SharedPreferences")
            }
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to retrieve User ID: ${e.message}")
            Log.e("ScreenTimeModule", "Error retrieving User ID", e)
        }
    }

    @ReactMethod
    fun checkWorkManagerStatus(promise: Promise) {
        try {
            // Use SharedPreferences to track WorkManager status
            val sharedPrefs = context.getSharedPreferences("ScreenTimePrefs", Context.MODE_PRIVATE)
            val isRunning = sharedPrefs.getBoolean("workmanager_running", false)

            promise.resolve(isRunning)
            Log.d("ScreenTimeModule", "WorkManager status check: $isRunning")
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to check WorkManager status: ${e.message}")
            Log.e("ScreenTimeModule", "Error checking WorkManager status", e)
        }
    }

    // Permission checking using AppOpsManager
    @ReactMethod
    fun checkUsagePermission(promise: Promise) {
        try {
            val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val mode = appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                android.os.Process.myUid(),
                context.packageName
            )

            val hasPermission = mode == AppOpsManager.MODE_ALLOWED
            promise.resolve(hasPermission)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to check usage permission: ${e.message}")
        }
    }

    // Open Usage Access Settings directly
    @ReactMethod
    fun openUsageAccessSettings(promise: Promise) {
        try {
            val currentActivity = currentActivity
            if (currentActivity != null) {
                val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
                currentActivity.startActivity(intent)
                promise.resolve("Usage Access settings opened")
                Log.d("ScreenTimeModule", "Opened Usage Access settings")
            } else {
                promise.reject("NO_ACTIVITY", "No current activity available")
                Log.e("ScreenTimeModule", "No current activity to open settings")
            }
        } catch (e: Exception) {
            // Fallback to general settings
            try {
                val currentActivity = currentActivity
                if (currentActivity != null) {
                    val intent = Intent(Settings.ACTION_SETTINGS)
                    currentActivity.startActivity(intent)
                    promise.resolve("General settings opened (fallback)")
                    Log.w("ScreenTimeModule", "Opened general settings as fallback")
                } else {
                    promise.reject("ERROR", "Failed to open settings: ${e.message}")
                }
            } catch (fallbackError: Exception) {
                promise.reject("ERROR", "Failed to open any settings: ${fallbackError.message}")
                Log.e("ScreenTimeModule", "Error opening settings", fallbackError)
            }
        }
    }

    @ReactMethod
    fun checkAccessibilityServicePermissions(promise: Promise) {
        try {
            val am = context.getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager
            val enabledServices = am.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)

            val packageName = context.packageName
            var hasPermission = false

            for (service in enabledServices) {
                val serviceInfo = service.resolveInfo.serviceInfo
                if (serviceInfo.packageName == packageName) {
                    hasPermission = true
                    break
                }
            }

            promise.resolve(hasPermission)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to check usage permission: ${e.message}")
        }
    }

    @ReactMethod
    fun openAccessibilityServiceSettings(promise:Promise) {
        try {
            val currentActivity = currentActivity
            if (currentActivity != null) {
                val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
                currentActivity.startActivity(intent)
                promise.resolve("Accessibility Service Access settings opened")
                Log.d("ScreenTimeModule", "Opened Accessibility Service Access settings")
            } else {
                promise.reject("NO_ACTIVITY", "No current activity available")
                Log.e("ScreenTimeModule", "No current activity to open settings")
            }
        } catch (e: Exception) {
            // Fallback to general settings
            try {
                val currentActivity = currentActivity
                if (currentActivity != null) {
                    val intent = Intent(Settings.ACTION_SETTINGS)
                    currentActivity.startActivity(intent)
                    promise.resolve("General settings opened (fallback)")
                    Log.w("ScreenTimeModule", "Opened general settings as fallback")
                } else {
                    promise.reject("ERROR", "Failed to open settings: ${e.message}")
                }
            } catch (fallbackError: Exception) {
                promise.reject("ERROR", "Failed to open any settings: ${fallbackError.message}")
                Log.e("ScreenTimeModule", "Error opening settings", fallbackError)
            }
        }
    }

    @ReactMethod
    fun startUsageStatsCollection(promise: Promise) {
        try {
            // Check permissions for UsageStatsManager
            val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val mode = appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                android.os.Process.myUid(),
                context.packageName
            )

            if (mode != AppOpsManager.MODE_ALLOWED) {
                promise.reject("PERMISSION_DENIED", "Usage access permission not granted")
                return
            }

            // Start WorkManager for periodic collection
            startPeriodicUsageCollection()

            // Store the running state in SharedPreferences
            val sharedPrefs = context.getSharedPreferences("ScreenTimePrefs", Context.MODE_PRIVATE)
            sharedPrefs.edit().putBoolean("workmanager_running", true).apply()

            promise.resolve("Usage stats collection started successfully")
            Log.d("ScreenTimeModule", "Usage stats collection started")

        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to start usage stats collection: ${e.message}")
            Log.e("ScreenTimeModule", "Error starting usage stats collection", e)
        }
    }

    @ReactMethod
    fun stopUsageStatsCollection(promise: Promise) {
        try {
            WorkManager.getInstance(context).cancelUniqueWork("usage_stats_worker")

            // Update the running state in SharedPreferences
            val sharedPrefs = context.getSharedPreferences("ScreenTimePrefs", Context.MODE_PRIVATE)
            sharedPrefs.edit().putBoolean("workmanager_running", false).apply()

            promise.resolve("Usage stats collection stopped")
            Log.d("ScreenTimeModule", "Usage stats collection stopped")
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to stop usage stats collection: ${e.message}")
        }
    }

    private fun startPeriodicUsageCollection() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.NOT_REQUIRED)
            .setRequiresBatteryNotLow(false)
            .setRequiresCharging(false)
            .build()

        val workRequest = PeriodicWorkRequestBuilder<UsageStatsWorker>(
            1, TimeUnit.HOURS
        )
            .setConstraints(constraints)
            .setBackoffCriteria(
                BackoffPolicy.LINEAR,
                10000L,
                TimeUnit.MILLISECONDS
            )
            .addTag("usage_stats_periodic")
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            "usage_stats_worker",
            ExistingPeriodicWorkPolicy.REPLACE,
            workRequest
        )
    }

    @ReactMethod
    fun setSupabaseCredentials(url: String, anonKey: String, promise: Promise) {
        try {
            val sharedPrefs = context.getSharedPreferences("ScreenTimePrefs", Context.MODE_PRIVATE)
            sharedPrefs.edit()
                .putString("supabase_url", url)
                .putString("supabase_anon_key", anonKey)
                .apply()

            promise.resolve("Supabase credentials stored successfully")
            Log.d("ScreenTimeModule", "Supabase credentials stored")
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to store Supabase credentials: ${e.message}")
            Log.e("ScreenTimeModule", "Error storing Supabase credentials", e)
        }
    }

    @ReactMethod
    fun getLastUploadTime(promise: Promise) {
        try {
            val sharedPrefs = context.getSharedPreferences("ScreenTimePrefs", Context.MODE_PRIVATE)
            val lastUploadTime = sharedPrefs.getLong("last_successful_upload_time", 0L)

            promise.resolve(lastUploadTime.toDouble())
            Log.d("ScreenTimeModule", "Retrieved last upload time: $lastUploadTime")
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to get last upload time: ${e.message}")
            Log.e("ScreenTimeModule", "Error getting last upload time", e)
        }
    }

    @ReactMethod
    fun getCachedDataCount(promise: Promise) {
        try {
            val cacheManager = CacheManager(context)
            val count = cacheManager.getCachedSessionsCount()
            promise.resolve(count)
            Log.d("ScreenTimeModule", "Retrieved cached data count: $count")
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to get cached data count: ${e.message}")
            Log.e("ScreenTimeModule", "Error getting cached data count", e)
        }
    }

    @ReactMethod
    fun clearCachedData(promise: Promise) {
        try {
            val cacheManager = CacheManager(context)
            cacheManager.clearAllCachedSessions()
            promise.resolve("Cached data cleared successfully")
            Log.d("ScreenTimeModule", "Cached data cleared")
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to clear cached data: ${e.message}")
            Log.e("ScreenTimeModule", "Error clearing cached data", e)
        }
    }

    @ReactMethod
    fun getLastPollTime(promise: Promise) {
        try {
            val sharedPrefs = context.getSharedPreferences("ScreenTimePrefs", Context.MODE_PRIVATE)
            val lastPollTime = sharedPrefs.getLong("last_poll_time", 0L)
            promise.resolve(lastPollTime.toDouble())
            Log.d("ScreenTimeModule", "Retrieved last poll time offline: $lastPollTime")
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to get last poll time offline: ${e.message}")
            Log.e("ScreenTimeModule", "Error getting last poll time offline", e)
        }
    }

    // Helper method to get stored user data for background tasks
    fun getStoredUserData(): Pair<String?, String?> {
        val sharedPrefs = context.getSharedPreferences("ScreenTimePrefs", Context.MODE_PRIVATE)
        val uuid = sharedPrefs.getString("user_uuid", null)
        val userId = sharedPrefs.getString("user_id", null)
        return Pair(uuid, userId)
    }
}
