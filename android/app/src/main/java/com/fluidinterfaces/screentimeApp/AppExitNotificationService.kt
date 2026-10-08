
package com.fluidinterfaces.screentimeApp

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.SharedPreferences
import android.net.Uri
import android.os.Build
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class AppExitNotificationService : AccessibilityService() {

    private var currentApp: String? = null
    private var previousApp: String? = null
    private lateinit var sharedPreferences: SharedPreferences
    private val serviceScope = CoroutineScope(Dispatchers.IO)
    private var notificationId = 1000
    private var screenStateReceiver: BroadcastReceiver? = null
    
    // Session tracking
    private var lastMonitoredApp: String? = null
    private var monitoredAppEntryTime: Long = 0L

    companion object {
        private const val TAG = "AppExitNotification"
        private const val CHANNEL_ID = "social_media_monitor_channel"
        private const val PREFS_NAME = "ScreenTimePrefs"
        private const val KEY_USER_ID = "user_id"
        private const val API_URL = "https://mobile-notification-server.vercel.app"
        private const val MIN_SESSION_DURATION_MS = 1000L  // Minimum 1 second in app before notification
    }

    private val monitoredApps = setOf(
        "com.instagram.android",
        "com.facebook.katana",
        "com.twitter.android",
        "com.snapchat.android",
        "com.zhiliaoapp.musically",
        "com.reddit.frontpage",
        "com.linkedin.android",
        "com.pinterest",
        "com.google.android.youtube",
        "com.xingin.xhs",
        "com.truthsocial.android.app",
        "com.linkedin.android",
        "com.google.android.youtube",
        "com.ss.android.ugc.trill"
    )
    
    // System packages to ignore (don't count as app switches)
    // Note: Launchers are intentionally NOT ignored - we want notifications when going to home screen
    private val ignoredPackages = setOf(
        "com.android.systemui",
        "android",
        "com.google.android.permissioncontroller",
        "com.android.packageinstaller",
        "com.android.settings",
        "com.samsung.android.app.cocktailbarservice",
        "com.android.chrome",
        "com.fluidinterfaces.screentimeApp"  // Our own app
    )

    // Class name patterns that indicate overlays/input methods (not real app switches)
    private val overlayClassPatterns = listOf(
        "inputmethod",
        "keyboard",
        "softinput",
        "ime",
        "popupwindow",
        "popup",
        "dialog",
        "menu",
        "toast",
        "contextmenu",
        "autocomplete",
        "listpopupwindow",
        "spinner",
        "actionmode",
        "pip",           // Picture-in-Picture
        "floatingwindow",
        "bubbles"
    )

    override fun onServiceConnected() {
        super.onServiceConnected()

        try {
            sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

            val info = AccessibilityServiceInfo().apply {
                // Only listen to window state changes (removed TYPE_WINDOW_CONTENT_CHANGED)
                eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
                feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
                notificationTimeout = 0  // No delay - immediate event processing
                flags = AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS or
                        AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS or
                        AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
            }
            serviceInfo = info

            createNotificationChannel()
            registerScreenStateReceiver()
            Log.d(TAG, "onServiceConnected: Setup complete!")
        } catch (e: Exception) {
            Log.e(TAG, "onServiceConnected: Error during setup", e)
        }
    }
    
    private fun registerScreenStateReceiver() {
        try {
            screenStateReceiver = object : BroadcastReceiver() {
                override fun onReceive(context: Context?, intent: Intent?) {
                    when (intent?.action) {
                        Intent.ACTION_SCREEN_OFF -> {
                            Log.d(TAG, "Screen turned OFF, current app: $currentApp")
                            handleScreenOff()
                        }
                        Intent.ACTION_SCREEN_ON -> {
                            Log.d(TAG, "Screen turned ON")
                        }
                    }
                }
            }
            
            val filter = IntentFilter().apply {
                addAction(Intent.ACTION_SCREEN_OFF)
                addAction(Intent.ACTION_SCREEN_ON)
            }
            
            registerReceiver(screenStateReceiver, filter)
            Log.d(TAG, "Screen state receiver registered")
        } catch (e: Exception) {
            Log.e(TAG, "Error registering screen state receiver", e)
        }
    }
    
    private fun handleScreenOff() {
        try {
            // If user locks screen while in a monitored app, trigger notification
            if (currentApp != null && currentApp in monitoredApps) {
                val appName = getAppName(currentApp!!)
                Log.i(TAG, "✓ Screen locked while in monitored app: $appName")
                sendLocalSurveyNotification(appName)
                // sendSurveyNotification(appName)  // Remote server notification (commented out)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error handling screen off", e)
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        try {
            if (event == null) {
                Log.w(TAG, "Received null accessibility event")
                return
            }

            when (event.eventType) {
                AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
                    val packageName = event.packageName?.toString()
                    val className = event.className?.toString()
                    Log.d(TAG, "Window changed: package=$packageName, class=$className")

                    // Check 1: Is this an overlay/input method based on class name?
                    if (isOverlayOrInputMethod(className)) {
                        Log.d(TAG, "Ignoring overlay/input method: $className")
                        return
                    }

                    packageName?.let {
                        // Filter out ignored system packages
                        if (it !in ignoredPackages) {
                            handleAppSwitch(it, className)
                        } else {
                            Log.d(TAG, "Ignoring system package: $it")
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "onAccessibilityEvent: Error handling event", e)
        }
    }

    /**
     * Check if the class name indicates an overlay, input method, or popup
     * that shouldn't be treated as an app switch.
     */
    private fun isOverlayOrInputMethod(className: String?): Boolean {
        if (className == null) return false
        val lowerClassName = className.lowercase()
        return overlayClassPatterns.any { pattern -> lowerClassName.contains(pattern) }
    }

    /**
     * Check if the monitored app is still visible in the window stack.
     * If it's still visible, the user hasn't actually left the app.
     */
    private fun isMonitoredAppStillVisible(monitoredPackage: String): Boolean {
        return try {
            windows?.any { window ->
                val windowPackage = window.root?.packageName?.toString()
                windowPackage == monitoredPackage
            } == true
        } catch (e: Exception) {
            Log.e(TAG, "Error checking window visibility", e)
            false  // Assume not visible on error
        }
    }

    private fun handleAppSwitch(newPackage: String, className: String?) {
        try {
            Log.d(TAG, "=== APP SWITCH ===")
            Log.d(TAG, "Previous: $previousApp | Current: $currentApp -> New: $newPackage (class: $className)")

            // Ignore if same app (prevents duplicate events)
            if (newPackage == currentApp) {
                Log.d(TAG, "Same app, ignoring")
                return
            }

            val leavingMonitoredApp = currentApp != null && currentApp in monitoredApps
            val enteringMonitoredApp = newPackage in monitoredApps

            // Case 1: Entering a monitored app
            if (enteringMonitoredApp) {
                // Record entry time for minimum session duration check
                monitoredAppEntryTime = System.currentTimeMillis()
                lastMonitoredApp = newPackage

                if (leavingMonitoredApp) {
                    Log.d(TAG, "✗ Switching between monitored apps: $currentApp -> $newPackage (no notification)")
                } else {
                    Log.d(TAG, "✗ ENTERING monitored app: $currentApp -> $newPackage (no notification)")
                }
            }
            // Case 2: Leaving a monitored app to a non-monitored app
            else if (leavingMonitoredApp && !enteringMonitoredApp) {
                val sessionDuration = System.currentTimeMillis() - monitoredAppEntryTime
                val monitoredPackage = currentApp!!
                val appName = getAppName(monitoredPackage)

                Log.i(TAG, "Potential exit from monitored app: $appName -> $newPackage (session: ${sessionDuration}ms)")

                // Check 2: Is the monitored app still visible in the window stack?
                // If yes, this is likely just an overlay (keyboard, settings, etc.)
                if (isMonitoredAppStillVisible(monitoredPackage)) {
                    Log.d(TAG, "✗ $appName is still visible in window stack - likely an overlay, not a real exit")
                    return  // Don't update currentApp, don't send notification
                }

                // Check minimum session duration and trigger notification
                if (sessionDuration >= MIN_SESSION_DURATION_MS) {
                    Log.i(TAG, "✓ Triggering IMMEDIATE notification for $appName (app no longer visible)")
                    sendLocalSurveyNotification(appName)
                } else {
                    Log.d(TAG, "✗ Session too short (${sessionDuration}ms < ${MIN_SESSION_DURATION_MS}ms), no notification")
                }
            }
            // Case 3: Moving between non-monitored apps
            else {
                Log.d(TAG, "✗ Non-monitored app transition: $currentApp -> $newPackage (no notification)")
            }

            previousApp = currentApp
            currentApp = newPackage
        } catch (e: Exception) {
            Log.e(TAG, "handleAppSwitch: Error", e)
        }
    }

    private fun sendLocalSurveyNotification(appName: String) {
        try {
            // Create intent to open the app to the survey page
            val intent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse("screentimeapp://survey")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("appName", appName)
                putExtra("timestamp", System.currentTimeMillis())
            }
            
            val pendingIntent = PendingIntent.getActivity(
                this,
                notificationId,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            
            // Build notification with maximum urgency settings for immediate display
            val notification = NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle("Left $appName")
                .setContentText("You just closed $appName. Time well spent?")
                .setPriority(NotificationCompat.PRIORITY_MAX)  // Maximum priority
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)  // Use MESSAGE for heads-up display
                .setAutoCancel(true)
                .setVibrate(longArrayOf(0, 250, 250, 250))
                .setContentIntent(pendingIntent)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setTimeoutAfter(60000)
                .setFullScreenIntent(pendingIntent, false)  // Request heads-up notification
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)  // Show on lock screen immediately
                .setOnlyAlertOnce(false)  // Always alert
                .build()
            
            // Post notification immediately
            val notificationManager = NotificationManagerCompat.from(this)
            notificationManager.notify(notificationId++, notification)
            
            Log.i(TAG, "✓ IMMEDIATE survey notification posted for $appName (timestamp: ${System.currentTimeMillis()})")
        } catch (e: Exception) {
            Log.e(TAG, "Error sending local notification", e)
        }
    }

    private fun sendSurveyNotification(appName: String) {
        serviceScope.launch {
            try {
                val userId = sharedPreferences.getString(KEY_USER_ID, null)

                if (userId == null) {
                    Log.e(TAG, "UserId not found in SharedPreferences")
                    return@launch
                }

                Log.d(TAG, "Fetching push token for user: $userId")

                // Get the push token from Supabase
                val pushToken = getPushTokenFromSupabase(userId)

                if (pushToken == null) {
                    Log.e(TAG, "No push token found for user: $userId")
                    return@launch
                }

                Log.d(TAG, "Push token retrieved, sending notification")

                // Send notification using the token
                val url = URL("$API_URL/notify/survey")
                val connection = url.openConnection() as HttpURLConnection

                connection.apply {
                    requestMethod = "POST"
                    setRequestProperty("Content-Type", "application/json")
                    doOutput = true
                    connectTimeout = 10000
                    readTimeout = 10000
                }

                val jsonBody = JSONObject().apply {
                    put("token", pushToken)
                    put("title", "Left $appName")
                    put("body", "You just closed $appName. Time well spent?")
                    put("channelId", "default")
                    put("data", JSONObject().apply {
                        put("appName", appName)
                        put("timestamp", System.currentTimeMillis())
                    })
                    put("sound", "default")
                    put("priority", "high")
                }

                connection.outputStream.use { os ->
                    os.write(jsonBody.toString().toByteArray())
                }

                val responseCode = connection.responseCode
                Log.d(TAG, "API Response code: $responseCode")

                if (responseCode == HttpURLConnection.HTTP_OK) {
                    Log.i(TAG, "Survey notification sent successfully")
                } else {
                    val errorStream = connection.errorStream?.bufferedReader()?.use { it.readText() }
                    Log.e(TAG, "API Error: $responseCode - $errorStream")
                }

                connection.disconnect()
            } catch (e: Exception) {
                Log.e(TAG, "Error calling API", e)
            }
        }
    }

    private fun getPushTokenFromSupabase(userId: String): String? {
        return try {
            val supabaseUrl = sharedPreferences.getString("supabase_url", null)
                ?: ""
            val supabaseKey = sharedPreferences.getString("supabase_anon_key", null)
                ?: ""
            Log.d(TAG, supabaseUrl)
            val url = URL("$supabaseUrl/rest/v1/users_screentime?id=eq.$userId&select=push_token")
            val connection = url.openConnection() as HttpURLConnection

            connection.apply {
                requestMethod = "GET"
                setRequestProperty("apikey", supabaseKey)
                setRequestProperty("Authorization", "Bearer $supabaseKey")
                connectTimeout = 10000
                readTimeout = 10000
            }

            val responseCode = connection.responseCode

            if (responseCode == HttpURLConnection.HTTP_OK) {
                val response = connection.inputStream.bufferedReader().use { it.readText() }
                Log.d(TAG, "Supabase response: $response")

                // Parse JSON array response
                val jsonArray = org.json.JSONArray(response)
                if (jsonArray.length() > 0) {
                    val tokenObj = jsonArray.getJSONObject(0)
                    val token = tokenObj.getString("push_token")
                    Log.d(TAG, "Token retrieved from Supabase")
                    connection.disconnect()
                    return@getPushTokenFromSupabase token
                }
            } else {
                val errorStream = connection.errorStream?.bufferedReader()?.use { it.readText() }
                Log.e(TAG, "Supabase Error: $responseCode - $errorStream")
            }

            connection.disconnect()
            null
        } catch (e: Exception) {
            Log.e(TAG, "Error fetching token from Supabase", e)
            null
        }
    }

    private fun getAppName(packageName: String): String {
        return when (packageName) {
            "com.instagram.android" -> "Instagram"
            "com.facebook.katana" -> "Facebook"
            "com.twitter.android" -> "Twitter"
            "com.snapchat.android" -> "Snapchat"
            "com.zhiliaoapp.musically" -> "TikTok"
            "com.reddit.frontpage" -> "Reddit"
            "com.linkedin.android" -> "LinkedIn"
            "com.pinterest" -> "Pinterest"
            "com.google.android.youtube" -> "YouTube"
            else -> "Social Media"
        }
    }

    private fun createNotificationChannel() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    "Social Media Exit Alerts",
                    NotificationManager.IMPORTANCE_HIGH  // High importance for immediate display
                ).apply {
                    description = "Notifications when leaving social media apps"
                    enableVibration(true)
                    enableLights(true)
                    setShowBadge(true)
                    setBypassDnd(false)  // Don't bypass DND (respects user settings)
                    lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
                }

                val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                notificationManager.createNotificationChannel(channel)
                Log.d(TAG, "Notification channel created with HIGH importance")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error creating notification channel", e)
        }
    }

    override fun onInterrupt() {
        Log.w(TAG, "onInterrupt: Service interrupted")
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "onDestroy: Service destroyed")
        
        // Unregister screen state receiver
        try {
            screenStateReceiver?.let {
                unregisterReceiver(it)
                screenStateReceiver = null
                Log.d(TAG, "Screen state receiver unregistered")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error unregistering screen state receiver", e)
        }
        
        currentApp = null
        previousApp = null
        lastMonitoredApp = null
        monitoredAppEntryTime = 0L
    }
}
