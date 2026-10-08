package com.fluidinterfaces.screentimeApp

import android.content.Context
import android.util.Log
import kotlinx.coroutines.*
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.*

class SupabaseApiClient(private val context: Context) {

    private val sharedPrefs = context.getSharedPreferences("ScreenTimePrefs", Context.MODE_PRIVATE)

    // set from React Native side
    private fun getSupabaseUrl(): String = sharedPrefs.getString("supabase_url", "") ?: ""
    private fun getSupabaseAnonKey(): String = sharedPrefs.getString("supabase_anon_key", "") ?: ""

    companion object {
        private const val LAST_SUCCESSFUL_UPLOAD_KEY = "last_successful_upload_time"
        private const val LAST_POLL_TIME_KEY = "last_poll_time"
        private const val DEFAULT_COLLECTION_INTERVAL = 60 * 60 * 1000L

        // Retry configuration
        const val MAX_IMMEDIATE_RETRIES = 1 // Retry once before caching
        const val MAX_CACHED_RETRIES = 168 // Max retries for cached data (7 days)
        const val RETRY_DELAY_MS = 2000L // Delay between retries
        const val CACHED_RETRY_DELAY_MS = 1000L // Shorter delay for cached uploads
    }

    // Usage Pull Session
    data class UsagePullRecord(
        val userId: Long,
        val startPollTime: String,
        val endPollTime: String
    )

    // Individual open/close app events
    data class EventRecord(
        val usagePullId: Long,
        val appName: String,
        val packageName: String,
        val eventTimestamp: Long,
        val eventType: String
    )

    suspend fun uploadUsageData(usageData: JSONObject): ApiResult {
        return withContext(Dispatchers.IO) {
            try {
                if (!isConfigured()) {
                    Log.e("SupabaseApiClient", "Supabase credentials not configured")
                    return@withContext ApiResult(false, "Supabase not configured")
                }

                // Transform the hybrid data for database insertion
                val (usagePullRecord, eventRecords) = transformEventDataForSupabase(usageData)

                Log.d("SupabaseApiClient", "Uploading usage data: ${eventRecords.size} events")

                // Insert usage_pull record
                val usagePullResult = insertUsagePullRecord(usagePullRecord)
                if (!usagePullResult.success) {
                    Log.e("SupabaseApiClient", "Failed to insert usage_pull record: ${usagePullResult.message}")
                    return@withContext usagePullResult
                }

                // Extract usage_pull_id from response
                val usagePullId = extractPushIdFromResponse(usagePullResult.data)
                if (usagePullId == null) {
                    Log.e("SupabaseApiClient", "Failed to extract usage_pull_id from response")
                    return@withContext ApiResult(false, "Failed to get usage_pull_id")
                }

                Log.d("SupabaseApiClient", "Created usage_pull record with ID: $usagePullId")

                // Insert events with the usage_pull_id
                val eventsWithPullId = eventRecords.map { it.copy(usagePullId = usagePullId) }
                val eventsResult = insertEventRecords(eventsWithPullId)
                if (!eventsResult.success) {
                    Log.e("SupabaseApiClient", "Failed to upload events: ${eventsResult.message}")
                    return@withContext eventsResult
                }

                // Update last successful upload time
                val uploadTime = usageData.getLong("collection_timestamp")
                updateLastSuccessfulUploadTime(uploadTime)
                Log.d("SupabaseApiClient", "Successfully uploaded usage data, updated last successful time to: $uploadTime")

                ApiResult(true, "Usage Data upload successful")

            } catch (e: Exception) {
                Log.e("SupabaseApiClient", "Error uploading usage data", e)
                ApiResult(false, "Usage Data upload failed: ${e.message}")
            }
        }
    }

    private fun transformEventDataForSupabase(eventData: JSONObject): Pair<UsagePullRecord, List<EventRecord>> {
        val userId = eventData.getString("user_id").toLong()
        val startTime = eventData.getLong("collection_start_time")
        val endTime = eventData.getLong("collection_end_time")

        // Format timestamps for PostgreSQL timestamptz
        val dateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
        dateFormat.timeZone = TimeZone.getTimeZone("UTC")
        val startPollTime = dateFormat.format(Date(startTime))
        val endPollTime = dateFormat.format(Date(endTime))

        // Create usage_pull record
        val usagePullRecord = UsagePullRecord(
            userId = userId,
            startPollTime = startPollTime,
            endPollTime = endPollTime
        )

        // Transform events
        val eventRecords = mutableListOf<EventRecord>()
        val eventsArray = eventData.getJSONArray("events")
        for (i in 0 until eventsArray.length()) {
            val eventDataItem = eventsArray.getJSONObject(i)
            eventRecords.add(EventRecord(
                usagePullId = 0L,
                appName = eventDataItem.getString("app_name"),
                packageName = eventDataItem.getString("package_name"),
                eventTimestamp = eventDataItem.getLong("event_timestamp"),
                eventType = eventDataItem.getString("event_type"),
            ))
        }

        return Pair(usagePullRecord, eventRecords)
    }

    private fun insertUsagePullRecord(usagePullRecord: UsagePullRecord): ApiResult {
        val data = JSONObject().apply {
            put("user_id", usagePullRecord.userId)
            put("start_poll_time", usagePullRecord.startPollTime)
            put("end_poll_time", usagePullRecord.endPollTime)
        }

        return makeApiCall("usage_pull_screentime", data, returnData = true)
    }

    private fun insertEventRecords(eventRecords: List<EventRecord>): ApiResult {
        val dataArray = JSONArray()
        val dateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
        dateFormat.timeZone = TimeZone.getTimeZone("UTC")

        eventRecords.forEach { record ->
            val eventData = JSONObject().apply {
                put("usage_pull_id", record.usagePullId)
                put("app_name", record.appName)
                put("package_name", record.packageName)
                put("event_timestamp", dateFormat.format(Date(record.eventTimestamp)))
                put("event_type", record.eventType)
            }
            dataArray.put(eventData)
        }

        return makeApiCall("app_events_screentime", dataArray)
    }

    private fun makeApiCall(tableName: String, data: Any, returnData: Boolean = false): ApiResult {
        var connection: HttpURLConnection? = null

        try {
            val apiUrl = "${getSupabaseUrl()}/rest/v1/$tableName"
            val url = URL(apiUrl)
            Log.d("SupabaseApiClient", "API URL: $apiUrl")

            connection = url.openConnection() as HttpURLConnection
            connection.apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Authorization", "Bearer ${getSupabaseAnonKey()}")
                setRequestProperty("apikey", getSupabaseAnonKey())
                if (returnData) {
                    setRequestProperty("Prefer", "return=representation")
                } else {
                    setRequestProperty("Prefer", "return=minimal")
                }
                doOutput = true
                connectTimeout = 30000
                readTimeout = 30000
            }

            OutputStreamWriter(connection.outputStream).use { writer ->
                writer.write(data.toString())
                writer.flush()
            }

            val responseCode = connection.responseCode

            return when (responseCode) {
                in 200..299 -> {
                    val responseData = if (returnData) {
                        readSuccessResponse(connection)
                    } else {
                        null
                    }
                    Log.d("SupabaseApiClient", "Upload to $tableName successful. Response code: $responseCode")
                    ApiResult(true, "Upload successful", responseData)
                }
                401 -> {
                    Log.e("SupabaseApiClient", "Unauthorized. Check your Supabase keys.")
                    ApiResult(false, "Unauthorized - Check API keys")
                }
                422 -> {
                    val errorBody = readErrorResponse(connection)
                    Log.e("SupabaseApiClient", "Validation error: $errorBody")
                    ApiResult(false, "Validation error: $errorBody")
                }
                else -> {
                    val errorBody = readErrorResponse(connection)
                    Log.e("SupabaseApiClient", "Upload to $tableName failed. Code: $responseCode, Body: $errorBody")
                    ApiResult(false, "Upload failed: HTTP $responseCode")
                }
            }

        } catch (e: Exception) {
            Log.e("SupabaseApiClient", "Network error during upload to $tableName", e)
            return ApiResult(false, "Network error: ${e.message}")
        } finally {
            connection?.disconnect()
        }
    }

    private fun readSuccessResponse(connection: HttpURLConnection): String {
        return try {
            BufferedReader(InputStreamReader(connection.inputStream)).use { reader ->
                reader.readText()
            }
        } catch (e: Exception) {
            Log.e("SupabaseApiClient", "Could not read success response", e)
            ""
        }
    }

    private fun readErrorResponse(connection: HttpURLConnection): String {
        return try {
            val errorStream = connection.errorStream ?: connection.inputStream
            BufferedReader(InputStreamReader(errorStream)).use { reader ->
                reader.readText()
            }
        } catch (e: Exception) {
            "Could not read error response"
        }
    }

    private fun extractPushIdFromResponse(responseData: String?): Long? {
        return try {
            if (responseData.isNullOrEmpty()) return null
            val jsonArray = JSONArray(responseData)
            if (jsonArray.length() > 0) {
                val firstObject = jsonArray.getJSONObject(0)
                firstObject.getLong("id")
            } else {
                null
            }
        } catch (e: Exception) {
            Log.e("SupabaseApiClient", "Error extracting push_id", e)
            null
        }
    }

    // Get the last successful upload time
    fun getLastSuccessfulUploadTime(): Long {
        return sharedPrefs.getLong(LAST_SUCCESSFUL_UPLOAD_KEY, 0L)
    }

    // Update the last successful upload time
    fun updateLastSuccessfulUploadTime(timestamp: Long) {
        sharedPrefs.edit().putLong(LAST_SUCCESSFUL_UPLOAD_KEY, timestamp).apply()
        Log.d("SupabaseApiClient", "Updated last successful upload time: $timestamp")
    }

    // Get the last poll time
    fun getLastPollTime(): Long {
        return sharedPrefs.getLong(LAST_POLL_TIME_KEY, 0L)
    }

    // Update the last poll time, avoids recollecting data
    fun updateLastPollTime(timestamp: Long) {
        sharedPrefs.edit().putLong(LAST_POLL_TIME_KEY, timestamp).apply()
        Log.d("SupabaseApiClient", "Updated last poll time: $timestamp")
    }

    // Get the start time for data collection
    fun getCollectionStartTime(): Long {
        val lastPoll = getLastPollTime()
        return if (lastPoll == 0L) {
            // If no previous poll, start from 1 hour ago
            System.currentTimeMillis() - DEFAULT_COLLECTION_INTERVAL
        } else {
            lastPoll
        }
    }

    // Reset poll time
    fun resetPollTime() {
        sharedPrefs.edit().remove(LAST_POLL_TIME_KEY).apply()
        Log.d("SupabaseApiClient", "Reset poll time")
    }

    fun setSupabaseCredentials(url: String, anonKey: String) {
        sharedPrefs.edit()
            .putString("supabase_url", url)
            .putString("supabase_anon_key", anonKey)
            .apply()
        Log.d("SupabaseApiClient", "Supabase credentials updated")
    }

    fun isConfigured(): Boolean {
        val url = getSupabaseUrl()
        val key = getSupabaseAnonKey()
        return url.isNotEmpty() && key.isNotEmpty()
    }

    fun clearCredentials() {
        sharedPrefs.edit()
            .remove("supabase_url")
            .remove("supabase_anon_key")
            .apply()
    }

    // Get synchronization status for debugging
    fun getSyncStatus(): SyncStatus {
        val lastPoll = getLastPollTime()
        val lastSuccessfulUpload = getLastSuccessfulUploadTime()
        val cacheManager = CacheManager(context)
        val cacheStats = cacheManager.getCacheStats()

        return SyncStatus(
            lastPollTime = lastPoll,
            lastSuccessfulUploadTime = lastSuccessfulUpload,
            pendingCachedSessions = cacheStats.sessionCount,
            isConfigured = isConfigured(),
            nextCollectionStartTime = getCollectionStartTime()
        )
    }

    data class SyncStatus(
        val lastPollTime: Long,
        val lastSuccessfulUploadTime: Long,
        val pendingCachedSessions: Int,
        val isConfigured: Boolean,
        val nextCollectionStartTime: Long
    )
}

data class ApiResult(
    val success: Boolean,
    val message: String,
    val data: String? = null
)
