package com.fluidinterfaces.screentimeApp

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.util.Log
import androidx.work.Worker
import androidx.work.WorkerParameters
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.delay
import org.json.JSONObject
import org.json.JSONArray
import java.text.SimpleDateFormat
import java.util.*

class UsageStatsWorker(
    context: Context,
    workerParams: WorkerParameters
) : Worker(context, workerParams) {

    private val sharedPrefs = context.getSharedPreferences("ScreenTimePrefs", Context.MODE_PRIVATE)
    private val apiClient = SupabaseApiClient(context)
    private val cacheManager = CacheManager(context)

    override fun doWork(): Result {
        return try {
            // Get user data
            val userUuid = sharedPrefs.getString("user_uuid", null)
            val userId = sharedPrefs.getString("user_id", null)

            if (userUuid == null || userId == null) {
                Log.e("UsageStatsWorker", "User data not found - UUID: $userUuid, UserID: $userId")
                return Result.failure()
            }

            Log.d("UsageStatsWorker", "Starting usage stats collection for User ID: $userId")

            // Try to upload any cached sessions
            val uploadedCachedSessions = uploadCachedSessions()
            Log.d("UsageStatsWorker", "Uploaded $uploadedCachedSessions cached sessions")

            // Get collection time range for new data
            val currentTime = System.currentTimeMillis()
            val startTime = apiClient.getCollectionStartTime()

            Log.d("UsageStatsWorker", "Collecting new usage data from ${Date(startTime)} to ${Date(currentTime)}")

            // Only collect new data if there's a meaningful time period
            if (currentTime - startTime < 60000) {
                Log.d("UsageStatsWorker", "Time period too short, skipping new collection")
                return Result.success()
            }

            // Collect raw events
            val appEvents = collectAppEvents(startTime, currentTime)

            if (appEvents.isNotEmpty()) {
                // Calculate sessions from events
                val success = processEvents(userUuid, userId, appEvents, startTime, currentTime)

                if (success) {
                    Log.d("UsageStatsWorker", "Usage stats collected and uploaded successfully")
                    Result.success()
                } else {
                    Log.w("UsageStatsWorker", "Upload failed, but data was cached")
                    Result.success()
                }
            } else {
                Log.d("UsageStatsWorker", "No usage events found for the time period")
                // Still update the timestamp to avoid getting stuck
                runBlocking {
                    apiClient.updateLastPollTime(currentTime)
                }
                Result.success()
            }
        } catch (e: Exception) {
            Log.e("UsageStatsWorker", "Error collecting usage stats", e)
            Result.failure()
        }
    }

    private fun uploadCachedSessions(): Int {
        if (!apiClient.isConfigured()) {
            Log.d("UsageStatsWorker", "API not configured, skipping cached uploads")
            return 0
        }

        var uploadedCount = 0
        val cachedSessions = cacheManager.getCachedSessions()

        Log.d("UsageStatsWorker", "Found ${cachedSessions.size} cached sessions to upload")

        cachedSessions.forEach { cachedSession ->
            try {
                Log.d("UsageStatsWorker", "Attempting to upload cached session: ${cachedSession.sessionId} (retry ${cachedSession.retryCount + 1})")
                val fixedData = fixCachedDataFormat(cachedSession.data)

                // Try uploading with retry logic for cached sessions too
                val result = runBlocking {
                    val firstAttempt = apiClient.uploadUsageData(fixedData)
                    if (firstAttempt.success) {
                        firstAttempt
                    } else {
                        Log.w("UsageStatsWorker", "Cached session upload failed, retrying: ${firstAttempt.message}")
                        delay(SupabaseApiClient.CACHED_RETRY_DELAY_MS)
                        apiClient.uploadUsageData(cachedSession.data)
                    }
                }

                if (result.success) {
                    // Remove from cache on successful upload
                    cacheManager.removeCachedSession(cachedSession.sessionId)
                    uploadedCount++
                    Log.d("UsageStatsWorker", "Successfully uploaded cached session: ${cachedSession.sessionId}")
                } else {
                    // Update retry count
                    val newRetryCount = cachedSession.retryCount + 1
                    cacheManager.updateRetryCount(cachedSession.sessionId, newRetryCount)

                    Log.w("UsageStatsWorker", "Failed to upload cached session ${cachedSession.sessionId} (attempt $newRetryCount): ${result.message}")

                    // Remove sessions that have failed too many times
                    if (newRetryCount >= SupabaseApiClient.MAX_CACHED_RETRIES) {
                        cacheManager.removeCachedSession(cachedSession.sessionId)
                        Log.w("UsageStatsWorker", "Removed cached session ${cachedSession.sessionId} after $newRetryCount failed retries")
                    }
                }
            } catch (e: Exception) {
                Log.e("UsageStatsWorker", "Error uploading cached session ${cachedSession.sessionId}", e)
                // Update retry count even on exception
                val newRetryCount = cachedSession.retryCount + 1
                cacheManager.updateRetryCount(cachedSession.sessionId, newRetryCount)

                if (newRetryCount >= SupabaseApiClient.MAX_CACHED_RETRIES) {
                    cacheManager.removeCachedSession(cachedSession.sessionId)
                    Log.w("UsageStatsWorker", "Removed cached session ${cachedSession.sessionId} after exception and $newRetryCount retries")
                }
            }
        }

        return uploadedCount
    }

    private fun fixCachedDataFormat(cachedData: JSONObject): JSONObject {
        val fixedData = JSONObject(cachedData.toString())

        // Check if events is a string that needs to be converted back to JSONArray
        val eventsValue = cachedData.get("events")
        if (eventsValue is String) {
            try {
                val eventsArray = JSONArray(eventsValue)
                fixedData.put("events", eventsArray)
            } catch (e: Exception) {
                Log.e("UsageStatsWorker", "Failed to parse cached events array", e)
            }
        }

        return fixedData
    }

    private fun collectAppEvents(startTime: Long, endTime: Long): List<AppEvent> {
        val usageStatsManager = applicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val events = mutableListOf<AppEvent>()

        try {
            // Query events only within the collection period
            val usageEvents = usageStatsManager.queryEvents(startTime, endTime)

            if (usageEvents == null) {
                Log.w("UsageStatsWorker", "UsageEvents query returned null")
                return events
            }

            var eventId = 1
            var eventsProcessed = 0

            while (usageEvents.hasNextEvent()) {
                val event = UsageEvents.Event()
                usageEvents.getNextEvent(event)
                eventsProcessed++

                val packageName = event.packageName
                val eventTime = event.timeStamp
                val eventType = event.eventType

                when (eventType) {
                    UsageEvents.Event.ACTIVITY_RESUMED -> {
                        val appName = getAppName(packageName) ?: packageName
                        events.add(AppEvent(
                            eventId = eventId++,
                            packageName = packageName,
                            appName = appName,
                            timestamp = eventTime,
                            eventType = EventType.APP_START
                        ))
                    }

                    UsageEvents.Event.ACTIVITY_PAUSED,
                    UsageEvents.Event.ACTIVITY_STOPPED -> {
                        val appName = getAppName(packageName) ?: packageName
                        events.add(AppEvent(
                            eventId = eventId++,
                            packageName = packageName,
                            appName = appName,
                            timestamp = eventTime,
                            eventType = EventType.APP_STOP
                        ))
                    }
                }
            }

            Log.d("UsageStatsWorker", "Processed $eventsProcessed events, collected ${events.size} app events")

        } catch (e: Exception) {
            Log.e("UsageStatsWorker", "Error collecting app events", e)
        }

        return events.sortedBy { it.timestamp }
    }

    private fun processEvents(
        userUuid: String,
        userId: String,
        events: List<AppEvent>,
        startTime: Long,
        endTime: Long
    ): Boolean {
        Log.d("UsageStatsWorker", "Processing events: ${events.size} events")

        runBlocking {
            apiClient.updateLastPollTime(endTime)
        }

        return uploadEventsWithRetry(userUuid, userId, events, startTime, endTime)
    }

    private fun uploadEventsWithRetry(
        userUuid: String,
        userId: String,
        events: List<AppEvent>,
        startTime: Long,
        endTime: Long
    ): Boolean {
        return try {
            if (!apiClient.isConfigured()) {
                Log.w("UsageStatsWorker", "Supabase API not configured, caching hybrid data")
                cacheFailedUpload(userUuid, userId, events, startTime, endTime)
                return false
            }

            // Create hybrid data payload
            val usageData = createEventDataPayload(userUuid, userId, events, startTime, endTime)

            // First attempt
            runBlocking {
                val result = apiClient.uploadUsageData(usageData)
                if (result.success) {
                    Log.d("UsageStatsWorker", "Successfully uploaded usage data on first attempt")
                    true
                } else {
                    Log.w("UsageStatsWorker", "First upload attempt failed: ${result.message}")

                    // Retry once more before caching
                    Log.d("UsageStatsWorker", "Retrying upload...")
                    delay(SupabaseApiClient.RETRY_DELAY_MS)

                    val retryResult = apiClient.uploadUsageData(usageData)
                    if (retryResult.success) {
                        Log.d("UsageStatsWorker", "Successfully uploaded usage data on retry")
                        true
                    } else {
                        Log.e("UsageStatsWorker", "Retry upload failed: ${retryResult.message}")
                        cacheFailedUpload(userUuid, userId, events, startTime, endTime)
                        false
                    }
                }
            }
        } catch (e: Exception) {
            Log.e("UsageStatsWorker", "Error during hybrid upload attempts", e)
            cacheFailedUpload(userUuid, userId, events, startTime, endTime)
            false
        }
    }

    private fun createEventDataPayload(
        userUuid: String,
        userId: String,
        events: List<AppEvent>,
        startTime: Long,
        endTime: Long
    ): JSONObject {
        val dateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
        val collectTime = System.currentTimeMillis()

        return JSONObject().apply {
            put("user_uuid", userUuid)
            put("user_id", userId)
            put("collection_start_time", startTime)
            put("collection_end_time", endTime)
            put("collection_timestamp", collectTime)
            put("collection_timestamp_formatted", dateFormat.format(Date(collectTime)))

            // Events data
            put("events", JSONArray().apply {
                events.forEach { event ->
                    put(JSONObject().apply {
                        put("event_id", event.eventId)
                        put("package_name", event.packageName)
                        put("app_name", event.appName)
                        put("event_timestamp", event.timestamp)
                        put("event_timestamp_formatted", dateFormat.format(Date(event.timestamp)))
                        put("event_type", event.eventType.name)
                    })
                }
            })

            // Summary statistics
            put("summary", JSONObject().apply {
                put("total_events", events.size)
                put("start_events", events.count { it.eventType == EventType.APP_START })
                put("stop_events", events.count { it.eventType == EventType.APP_STOP })
                put("unique_apps", events.map { it.packageName }.toSet().size)
                put("collection_period_start", dateFormat.format(Date(startTime)))
                put("collection_period_end", dateFormat.format(Date(endTime)))
            })

            // Device info
            put("device_info", JSONObject().apply {
                put("android_version", android.os.Build.VERSION.RELEASE)
                put("device_model", "${android.os.Build.MANUFACTURER} ${android.os.Build.MODEL}")
                put("app_version", getAppVersion())
            })
        }
    }

    private fun cacheFailedUpload(
    userUuid: String,
    userId: String,
    events: List<AppEvent>,
    startTime: Long,
    endTime: Long
    ) {
        val usageData = createEventDataPayload(userUuid, userId, events, startTime, endTime)
        val sessionId = cacheManager.cacheUsageSession(usageData)
        if (sessionId != null) {
            Log.d("UsageStatsWorker", "Cached failed upload session: $sessionId")
        } else {
            Log.e("UsageStatsWorker", "Failed to cache usage data - data may be lost!")
        }
    }

    private fun getAppName(packageName: String): String? {
        return try {
            val packageManager = applicationContext.packageManager
            val applicationInfo = packageManager.getApplicationInfo(packageName, 0)
            packageManager.getApplicationLabel(applicationInfo).toString()
        } catch (e: Exception) {
            null
        }
    }

    private fun getAppVersion(): String {
        return try {
            val packageManager = applicationContext.packageManager
            val packageInfo = packageManager.getPackageInfo(applicationContext.packageName, 0)
            packageInfo.versionName ?: "Unknown"
        } catch (e: Exception) {
            "Unknown"
        }
    }

    // Data classes
    data class AppEvent(
        val eventId: Int,
        val packageName: String,
        val appName: String,
        val timestamp: Long,
        val eventType: EventType
    )

    enum class EventType {
        APP_START,
        APP_STOP
    }
}
