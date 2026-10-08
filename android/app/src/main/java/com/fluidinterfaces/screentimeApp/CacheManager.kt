package com.fluidinterfaces.screentimeApp

import android.content.Context
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileWriter
import java.io.FileReader
import java.util.*

class CacheManager(private val context: Context) {

    companion object {
        private const val CACHE_DIR_NAME = "usage_data_cache"
        private const val CACHE_FILE_PREFIX = "usage_session_"
        private const val CACHE_FILE_SUFFIX = ".json"
        private const val MAX_CACHE_FILES = 336 // 2 weeks
    }

    private val cacheDir: File by lazy {
        File(context.cacheDir, CACHE_DIR_NAME).apply {
            if (!exists()) {
                mkdirs()
            }
        }
    }

    // Cache a usage data session that failed to upload
    fun cacheUsageSession(usageData: JSONObject): String? {
        return try {
            val sessionId = generateSessionId(usageData)
            val cacheFile = File(cacheDir, "$CACHE_FILE_PREFIX$sessionId$CACHE_FILE_SUFFIX")

            // Add metadata to the cached data
            val cachedData = JSONObject(usageData.toString()).apply {
                put("cached_timestamp", System.currentTimeMillis())
                put("session_id", sessionId)
                put("retry_count", 0)
                put("upload_status", "cached")
            }

            FileWriter(cacheFile).use { writer ->
                writer.write(cachedData.toString(2))
            }

            Log.d("CacheManager", "Cached usage session: $sessionId")

            // Clean up old cache files if we exceed the limit
            cleanupOldCacheFiles()

            sessionId
        } catch (e: Exception) {
            Log.e("CacheManager", "Error caching usage session", e)
            null
        }
    }

    // Get all cached sessions that need to be uploaded
    fun getCachedSessions(): List<CachedSession> {
        val cachedSessions = mutableListOf<CachedSession>()

        try {
            val cacheFiles = cacheDir.listFiles { file ->
                file.name.startsWith(CACHE_FILE_PREFIX) && file.name.endsWith(CACHE_FILE_SUFFIX)
            }

            cacheFiles?.sortedBy { it.lastModified() }?.forEach { file ->
                try {
                    val content = FileReader(file).use { it.readText() }
                    val jsonData = JSONObject(content)

                    cachedSessions.add(
                        CachedSession(
                            sessionId = jsonData.getString("session_id"),
                            file = file,
                            data = jsonData,
                            cachedTimestamp = jsonData.getLong("cached_timestamp"),
                            retryCount = jsonData.optInt("retry_count", 0)
                        )
                    )
                } catch (e: Exception) {
                    Log.w("CacheManager", "Failed to read cached session file: ${file.name}", e)
                    // Delete corrupted files
                    file.delete()
                }
            }
        } catch (e: Exception) {
            Log.e("CacheManager", "Error getting cached sessions", e)
        }

        return cachedSessions
    }

    // Remove a cached session after successful upload
    fun removeCachedSession(sessionId: String): Boolean {
        return try {
            val cacheFile = File(cacheDir, "$CACHE_FILE_PREFIX$sessionId$CACHE_FILE_SUFFIX")
            val deleted = cacheFile.delete()
            if (deleted) {
                Log.d("CacheManager", "Removed cached session: $sessionId")
            } else {
                Log.w("CacheManager", "Failed to remove cached session: $sessionId")
            }
            deleted
        } catch (e: Exception) {
            Log.e("CacheManager", "Error removing cached session: $sessionId", e)
            false
        }
    }

    // Update retry count for a cached session
    fun updateRetryCount(sessionId: String, retryCount: Int): Boolean {
        return try {
            val cacheFile = File(cacheDir, "$CACHE_FILE_PREFIX$sessionId$CACHE_FILE_SUFFIX")
            if (!cacheFile.exists()) return false

            val content = FileReader(cacheFile).use { it.readText() }
            val jsonData = JSONObject(content)
            jsonData.put("retry_count", retryCount)
            jsonData.put("last_retry_timestamp", System.currentTimeMillis())

            FileWriter(cacheFile).use { writer ->
                writer.write(jsonData.toString(2))
            }

            Log.d("CacheManager", "Updated retry count for session $sessionId: $retryCount")
            true
        } catch (e: Exception) {
            Log.e("CacheManager", "Error updating retry count for session: $sessionId", e)
            false
        }
    }

    // Get count of cached sessions
    fun getCachedSessionsCount(): Int {
        return try {
            val cacheFiles = cacheDir.listFiles { file ->
                file.name.startsWith(CACHE_FILE_PREFIX) && file.name.endsWith(CACHE_FILE_SUFFIX)
            }
            cacheFiles?.size ?: 0
        } catch (e: Exception) {
            Log.e("CacheManager", "Error getting cached sessions count", e)
            0
        }
    }

    // Clear all cached sessions
    fun clearAllCachedSessions(): Boolean {
        return try {
            val cacheFiles = cacheDir.listFiles { file ->
                file.name.startsWith(CACHE_FILE_PREFIX) && file.name.endsWith(CACHE_FILE_SUFFIX)
            }

            var allDeleted = true
            cacheFiles?.forEach { file ->
                if (!file.delete()) {
                    allDeleted = false
                    Log.w("CacheManager", "Failed to delete cached file: ${file.name}")
                }
            }

            Log.d("CacheManager", "Cleared ${cacheFiles?.size ?: 0} cached sessions")
            allDeleted
        } catch (e: Exception) {
            Log.e("CacheManager", "Error clearing cached sessions", e)
            false
        }
    }

    // Clean up old cache files if we exceed the maximum limit
    private fun cleanupOldCacheFiles() {
        try {
            val cacheFiles = cacheDir.listFiles { file ->
                file.name.startsWith(CACHE_FILE_PREFIX) && file.name.endsWith(CACHE_FILE_SUFFIX)
            }

            if (cacheFiles != null && cacheFiles.size > MAX_CACHE_FILES) {
                // Sort by last modified time (oldest first)
                val sortedFiles = cacheFiles.sortedBy { it.lastModified() }
                val filesToDelete = sortedFiles.take(sortedFiles.size - MAX_CACHE_FILES)

                filesToDelete.forEach { file ->
                    if (file.delete()) {
                        Log.d("CacheManager", "Deleted old cache file: ${file.name}")
                    }
                }
            }
        } catch (e: Exception) {
            Log.e("CacheManager", "Error cleaning up old cache files", e)
        }
    }

    // Generate a unique session ID based on the usage data
    private fun generateSessionId(usageData: JSONObject): String {
        val timestamp = usageData.optLong("timestamp", System.currentTimeMillis())
        val userId = usageData.optString("user_id", "unknown")
        val startTime = usageData.optLong("collection_start_time", 0)

        return "${userId}_${startTime}_${timestamp}"
    }

    // Get cache statistics for debugging
    fun getCacheStats(): CacheStats {
        return try {
            val cacheFiles = cacheDir.listFiles { file ->
                file.name.startsWith(CACHE_FILE_PREFIX) && file.name.endsWith(CACHE_FILE_SUFFIX)
            }

            var totalSize = 0L
            var oldestTimestamp = Long.MAX_VALUE
            var newestTimestamp = 0L

            cacheFiles?.forEach { file ->
                totalSize += file.length()
                val lastModified = file.lastModified()
                if (lastModified < oldestTimestamp) oldestTimestamp = lastModified
                if (lastModified > newestTimestamp) newestTimestamp = lastModified
            }

            CacheStats(
                sessionCount = cacheFiles?.size ?: 0,
                totalSizeBytes = totalSize,
                oldestCacheTimestamp = if (oldestTimestamp == Long.MAX_VALUE) 0 else oldestTimestamp,
                newestCacheTimestamp = newestTimestamp
            )
        } catch (e: Exception) {
            Log.e("CacheManager", "Error getting cache stats", e)
            CacheStats(0, 0, 0, 0)
        }
    }

    data class CachedSession(
        val sessionId: String,
        val file: File,
        val data: JSONObject,
        val cachedTimestamp: Long,
        val retryCount: Int
    )

    data class CacheStats(
        val sessionCount: Int,
        val totalSizeBytes: Long,
        val oldestCacheTimestamp: Long,
        val newestCacheTimestamp: Long
    )
}
