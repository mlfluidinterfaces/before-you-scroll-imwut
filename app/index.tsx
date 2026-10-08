import { SleepTimeModal } from "@/components/SleepTimeModal";
import ScreenTimeService from "@/modules/ScreenTimeCollector";
import {
  handleDeeplink,
  registerForPushNotificationsAsync,
} from "@/utils/notifications";
import { ensureUserExists, getOrCreateUserId, getSleepTimePreference, updateUserSleepTime } from "@/utils/userId";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import * as Updates from "expo-updates";
import React, { useEffect, useState } from "react";
import {
  Alert,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface ServiceResponse {
  success: boolean;
  message: string;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const App: React.FC = () => {
  const [isCollecting, setIsCollecting] = useState<boolean>(false);
  const [hasUsagePermission, setHasUsagePermission] = useState<boolean>(false);
  const [hasAccessibilityPermission, setHasAccessibilityPermission] =
    useState<boolean>(false);
  const [sessionInitialized, setSessionInitialized] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [userUuid, setUserUuid] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [lastUploadTime, setLastUploadTime] = useState<Date | null>(null);
  const [cachedDataCount, setCachedDataCount] = useState<number>(0);
  const [userCreationStatus, setUserCreationStatus] =
    useState<string>("pending");
  const [expoPushToken, setExpoPushToken] = useState("");
  const [notification, setNotification] = useState<
    Notifications.Notification | undefined
  >(undefined);
  const [notificationsInitialized, setNotificationsInitialized] =
    useState<boolean>(false);
  const [showSleepTimeModal, setShowSleepTimeModal] = useState<boolean>(false);

  useEffect(() => {
    let notificationListener: Notifications.EventSubscription;
    let responseListener: Notifications.EventSubscription;
    
    const setupNotifications = async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (token) {
          setExpoPushToken(token);
          setNotificationsInitialized(true);
          console.log("Push token obtained:", token);
        } else {
          console.log("Failed to get push token");
          setNotificationsInitialized(false);
        }
      } catch (error) {
        console.error("Error setting up notifications:", error);
        setExpoPushToken(`Error: ${error}`);
        setNotificationsInitialized(false);
      }
    };

 

      setupNotifications();

    // Setup notification listeners only (token registration moved to initialization)
    notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        setNotification(notification);
      }
    );

    responseListener = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const data = response.notification.request.content.data;
        if (data?.url && typeof data.url === "string") {
          console.log("Handling deep link:", data.url);
          await handleDeeplink(data.url);
        } else {
          console.log("No URL found, navigating to home");
          router.push("/");
        }
      }
    );

    return () => {
      if (notificationListener) notificationListener.remove();
      if (responseListener) responseListener.remove();
    };
  }, []);

  useEffect(() => {
    checkForUpdates();
    initializeApp();
  }, []);

  // Refresh timing checks every minute
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isInitializing && sessionInitialized) {
        checkStatus();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [isInitializing, sessionInitialized]);



  const checkForUpdates = async (): Promise<void> => {
    try {
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        console.log("Update available:", update);

        // Show update dialog
        Alert.alert(
          "Update Available",
          "A new version of the app is available. Would you like to update now?",
          [
            {
              text: "Later",
              style: "cancel",
            },
            {
              text: "Update Now",
              onPress: async () => {
                try {
                  await Updates.fetchUpdateAsync();
                  await Updates.reloadAsync();
                } catch (error) {
                  console.error("Error applying update:", error);
                  Alert.alert(
                    "Update Failed",
                    "Failed to apply update. Please try restarting the app."
                  );
                }
              },
            },
          ]
        );
      } else {
        console.log("No updates available");
      }
    } catch (error) {
      console.error("Error checking for updates:", error);
      // Don't show error to user, just log it
    }
  };

  const initializeApp = async (): Promise<void> => {
    setIsInitializing(true);
    setUserCreationStatus("pending");

    try {
      // Check if .env variables are available
      if (
        !process.env.EXPO_PUBLIC_SUPABASE_URL ||
        !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
      ) {
        Alert.alert(
          "Configuration Error",
          "Supabase credentials not found in .env file"
        );
        return;
      }

      // Initialize user session with Supabase credentials
      await initializeUserSession();

      // Check other statuses
      await checkUsagePermissionStatus();
      await checkAccessibilityServiceStatus();
      await checkWorkManagerStatus();
      await checkLastUploadTime();
      await checkCachedDataCount();
    } catch (error) {
      console.error("Error initializing app:", error);
      Alert.alert(
        "Initialization Error",
        "Failed to initialize app. Please try again."
      );
    } finally {
      setIsInitializing(false);
    }
  };

  const initializeUserSession = async (): Promise<void> => {
    try {
      setUserCreationStatus("getting_uuid");

      // Get or create UUID from SecureStore
      const uuid = await getOrCreateUserId();
      console.log("User UUID from SecureStore:", uuid);
      setUserUuid(uuid);

      setUserCreationStatus("registering_push_notifications");

      // Get push token before creating user in database
      let pushToken: string | undefined;
      try {
        pushToken = await registerForPushNotificationsAsync();
        if (pushToken) {
          setExpoPushToken(pushToken);
          setNotificationsInitialized(true);
          console.log("Push token obtained:", pushToken);
        } else {
          console.log("Failed to get push token, proceeding without it");
          setNotificationsInitialized(false);
        }
      } catch (error) {
        console.error("Error getting push token:", error);
        setExpoPushToken(`Error: ${error}`);
        setNotificationsInitialized(false);
        // Continue without push token
      }

      setUserCreationStatus("ensuring_user_exists");

      // Ensure user exists in database with push token (single database operation)
      try {
        await ensureUserExists(uuid, pushToken);
        console.log("User verified/created in database with push token:", uuid);
        setUserCreationStatus("user_verified");
      } catch (error) {
        console.error("Failed to ensure user exists:", error);
        setUserCreationStatus("user_creation_failed");
        Alert.alert(
          "Database Error",
          "Failed to verify or create user in database. Please check your internet connection and try again."
        );
        return;
      }

      setUserCreationStatus("initializing_session");

      // Initialize complete user session with Supabase credentials
      const result = await ScreenTimeService.initializeUserSession(
        uuid,
        process.env.EXPO_PUBLIC_SUPABASE_URL!,
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
      );

      if (result.success) {
        setSessionInitialized(true);
        setUserCreationStatus("session_initialized");
        console.log("User session successfully initialized:", result.message);
        
        // Check if sleep time is set, if not show modal
        const sleepTime = await getSleepTimePreference();
        if (!sleepTime) {
          console.log("Sleep time not set, showing modal");
          setShowSleepTimeModal(true);
        }

        // Verify what was stored
        const userIdResult = await ScreenTimeService.getUserId();
        if (userIdResult.success && userIdResult.userId) {
          setUserId(userIdResult.userId);
          console.log("User session ready:", uuid, "with database ID:", userIdResult.userId);
        } else {
          console.log("User session ready (UUID only):", uuid);
        }
      } else {
        setSessionInitialized(false);
        setUserCreationStatus("session_failed");
        console.error("Failed to initialize user session:", result.message);
        Alert.alert("Session Error", result.message);
      }
    } catch (error) {
      setSessionInitialized(false);
      setUserCreationStatus("error");
      console.error("Error initializing user session:", error);
      Alert.alert(
        "Error",
        "Failed to initialize user session. Please check your network connection."
      );
    }
  };

  const checkUsagePermissionStatus = async (): Promise<void> => {
    const permission: boolean = await ScreenTimeService.checkUsagePermission();
    setHasUsagePermission(permission);
  };

  const checkWorkManagerStatus = async (): Promise<void> => {
    const isRunning: boolean = await ScreenTimeService.checkWorkManagerStatus();
    setIsCollecting(isRunning);
  };

  const checkAccessibilityServiceStatus = async (): Promise<void> => {
    const permission: boolean =
      await ScreenTimeService.checkAccessibilityServicePermission();
    setHasAccessibilityPermission(permission);
  };

  const checkLastUploadTime = async (): Promise<void> => {
    try {
      const result = await ScreenTimeService.getLastUploadTime();
      if (result.success && result.timestamp && result.timestamp > 0) {
        setLastUploadTime(new Date(result.timestamp));
      } else {
        setLastUploadTime(null);
      }
    } catch (error) {
      console.error("Error checking last upload time:", error);
    }
  };

  const checkCachedDataCount = async (): Promise<void> => {
    try {
      const result = await ScreenTimeService.getCachedDataCount();
      if (result.success && typeof result.count === "number") {
        setCachedDataCount(result.count);
      } else {
        setCachedDataCount(0);
      }
    } catch (error) {
      console.error("Error checking cached data count:", error);
      setCachedDataCount(0);
    }
  };

  const handleSaveSleepTime = async (bedtime: string): Promise<void> => {
    try {
      const uuid = await getOrCreateUserId();
      await updateUserSleepTime(uuid, bedtime);
      
      setShowSleepTimeModal(false);
      
      Alert.alert(
        "Bedtime Saved",
        "Your bedtime has been saved successfully!"
      );
    } catch (error) {
      console.error("Error saving bedtime:", error);
      Alert.alert(
        "Error",
        "Failed to save bedtime. Please try again."
      );
    }
  };

  const handleStartCollection = async (): Promise<void> => {
    if (!sessionInitialized) {
      Alert.alert(
        "Session Required",
        "User session is not initialized. Please refresh the app.",
        [
          {
            text: "Refresh",
            onPress: () => initializeApp(),
          },
        ]
      );
      return;
    }

    if (userCreationStatus !== "session_initialized") {
      Alert.alert(
        "User Setup Required",
        "User account is still being set up. Please wait or refresh the app.",
        [
          {
            text: "Refresh",
            onPress: () => initializeApp(),
          },
        ]
      );
      return;
    }

    const result: ServiceResponse =
      await ScreenTimeService.startUsageStatsCollection();

    if (result.success) {
      setIsCollecting(true);
      Alert.alert(
        "Success",
        `Hourly usage stats collection started! Data will be collected every hour and uploaded to Supabase with User ID: ${userId}\n\nNote: Collection may be delayed by battery optimization.`
      );
    } else {
      Alert.alert("Error", result.message);
      if (result.message === "Permission required") {
        setTimeout(() => {
          checkUsagePermissionStatus();
        }, 1000);
      }
    }
  };

  const handleStopCollection = async (): Promise<void> => {
    const result: ServiceResponse =
      await ScreenTimeService.stopUsageStatsCollection();

    if (result.success) {
      setIsCollecting(false);
      Alert.alert("Success", "Usage stats collection stopped.");
    } else {
      Alert.alert("Error", result.message);
    }
  };

  const handleRequestUsagePermission = (): void => {
    ScreenTimeService.requestUsagePermission();

    // Recheck whether has permissions
    setTimeout(() => {
      checkUsagePermissionStatus();
    }, 2000);
  };

  const handleRequestAccessibilityPermission = (): void => {
    ScreenTimeService.requestAccessibilityServicePermission();

    // Recheck whether has permissions
    setTimeout(() => {
      checkAccessibilityServiceStatus();
    }, 2000);
  };

  // Status check from native, update timings
  const checkStatus = async (): Promise<void> => {
    try {
      const isRunning = await ScreenTimeService.checkWorkManagerStatus();
      setIsCollecting(isRunning);

      const uploadResult = await ScreenTimeService.getLastUploadTime();
      if (
        uploadResult.success &&
        uploadResult.timestamp &&
        uploadResult.timestamp > 0
      ) {
        setLastUploadTime(new Date(uploadResult.timestamp));
      } else {
        setLastUploadTime(null);
      }

      const cacheResult = await ScreenTimeService.getCachedDataCount();
      if (cacheResult.success && typeof cacheResult.count === "number") {
        setCachedDataCount(cacheResult.count);
      } else {
        setCachedDataCount(0);
      }
    } catch (error) {
      console.error("Error checking status offline:", error);
    }
  };

  // Check Status Details
  const handleRefreshStatus = async (): Promise<void> => {
    await checkStatus();

    const pollResult = await ScreenTimeService.getLastPollTime();
    const uploadResult = await ScreenTimeService.getLastUploadTime();

    const pollTime =
      pollResult.success && pollResult.timestamp
        ? new Date(pollResult.timestamp).toLocaleString()
        : "Never";
    const uploadTime =
      uploadResult.success && uploadResult.timestamp
        ? new Date(uploadResult.timestamp).toLocaleString()
        : "Never";

    Alert.alert(
      "Offline Status",
      `Cache: ${cachedDataCount} sessions\nLast Poll: ${pollTime}\nLast Upload: ${uploadTime}\nCollection: ${
        isCollecting ? "Active" : "Inactive"
      }`,
      [{ text: "OK" }]
    );
  };

  const handleCacheManagement = (): void => {
    ScreenTimeService.showCacheManagement(cachedDataCount);
  };

  const handleVerifySession = async (): Promise<void> => {
    try {
      const uuidResult = await ScreenTimeService.getUserUuid();
      const userIdResult = await ScreenTimeService.getUserId();
      const lastUploadResult = await ScreenTimeService.getLastUploadTime();
      const cachedResult = await ScreenTimeService.getCachedDataCount();
      const secureStoreUserId = await getOrCreateUserId();

      let message = "Session Verification:\n\n";

      if (uuidResult.success && uuidResult.uuid === secureStoreUserId) {
        message += "UUID: Properly synced\n";
      } else {
        message += `UUID: Mismatch\nSecureStore: ${secureStoreUserId}\nNative: ${
          uuidResult.uuid || "Not found"
        }\n`;
      }

      if (userIdResult.success && userIdResult.userId) {
        message += `User ID: ${userIdResult.userId}\n`;
      } else {
        message += "User ID: Not found in native storage\n";
      }

      message += `User Creation Status: ${userCreationStatus}\n`;

      if (cachedResult.success && typeof cachedResult.count === "number") {
        message += `Cached Sessions: ${cachedResult.count}\n`;
      }

      if (
        lastUploadResult.success &&
        lastUploadResult.timestamp &&
        lastUploadResult.timestamp > 0
      ) {
        message += `Last Upload: ${new Date(
          lastUploadResult.timestamp
        ).toLocaleString()}`;
      } else {
        message += "Last Upload: No previous uploads";
      }

      Alert.alert("Session Status", message, [
        {
          text: "Re-initialize",
          onPress: () => initializeUserSession(),
        },
        {
          text: "OK",
          style: "cancel",
        },
      ]);
    } catch (error) {
      Alert.alert("Error", "Failed to verify session status");
    }
  };

  const formatLastUploadTime = (date: Date | null): string => {
    if (!date) return "Never";

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const getNextCollectionTime = (): string => {
    if (!lastUploadTime) return "Within 1 hour";

    const nextCollection = new Date(lastUploadTime.getTime() + 60 * 60 * 1000); // Add 1 hour
    const now = new Date();

    if (nextCollection <= now) return "Due now";

    const diffMs = nextCollection.getTime() - now.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 60) return `In ${diffMinutes}m`;
    const diffHours = Math.floor(diffMinutes / 60);
    return `In ${diffHours}h ${diffMinutes % 60}m`;
  };

  const getUserCreationStatusText = (): string => {
    switch (userCreationStatus) {
      case "getting_uuid":
        return "Getting user ID...";
      case "registering_push_notifications":
        return "Registering push notifications...";
      case "ensuring_user_exists":
        return "Creating user account...";
      case "user_verified":
        return "User account created";
      case "initializing_session":
        return "Initializing session...";
      case "session_initialized":
        const notifStatus = notificationsInitialized
          ? " & notifications ready"
          : " (notifications unavailable)";
        return `Ready${notifStatus}`;
      case "user_creation_failed":
        return "Failed to create user";
      case "session_failed":
        return "Session initialization failed";
      case "error":
        return "Initialization error";
      default:
        return "Setting up...";
    }
  };

  const getCollectionStatusText = (): string => {
    if (!isCollecting) return "Inactive";
    return "Active (Hourly)";
  };

  const getCacheStatusColor = (): string => {
    if (cachedDataCount === 0) return "#4CAF50";
    if (cachedDataCount < 5) return "#FF9800";
    return "#F44336";
  };

  if (isInitializing) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <Text style={styles.title}>Initializing...</Text>
        <Text style={styles.infoText}>{getUserCreationStatusText()}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.headerContainer}>
        <Text style={styles.title}>Screen Time Usage Collection</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => {
            router.push("/testing");
          }}
        >
          <Text style={styles.settingsButtonText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>User Session:</Text>
        <Text
          style={[
            styles.statusValue,
            {
              color:
                sessionInitialized &&
                userCreationStatus === "session_initialized"
                  ? "#4CAF50"
                  : "#F44336",
            },
          ]}
        >
          {sessionInitialized && userCreationStatus === "session_initialized"
            ? "Initialized"
            : "Not Initialized"}
        </Text>
      </View>

      {sessionInitialized && (
        <>
          <View style={styles.statusContainer}>
            <Text style={styles.statusLabel}>Last Upload:</Text>
            <Text style={[styles.statusValue, { color: "#666", fontSize: 13 }]}>
              {formatLastUploadTime(lastUploadTime)}
            </Text>
          </View>

          <View style={styles.statusContainer}>
            <Text style={styles.statusLabel}>Cached Data:</Text>
            <TouchableOpacity onPress={handleCacheManagement}>
              <Text
                style={[
                  styles.statusValue,
                  { color: getCacheStatusColor(), fontSize: 13 },
                ]}
              >
                {cachedDataCount === 0
                  ? "All synced"
                  : `${cachedDataCount} session${
                      cachedDataCount === 1 ? "" : "s"
                    }`}
              </Text>
            </TouchableOpacity>
          </View>

          {isCollecting && (
            <View style={styles.statusContainer}>
              <Text style={styles.statusLabel}>Next Collection:</Text>
              <Text
                style={[styles.statusValue, { color: "#2196F3", fontSize: 13 }]}
              >
                {getNextCollectionTime()}
              </Text>
            </View>
          )}
        </>
      )}

      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Permission Status:</Text>
        <Text
          style={[
            styles.statusValue,
            {
              color:
                hasUsagePermission && hasAccessibilityPermission
                  ? "#4CAF50"
                  : "#F44336",
            },
          ]}
        >
          {hasUsagePermission && hasAccessibilityPermission
            ? "Granted"
            : "Not Granted"}
        </Text>
      </View>

      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Collection Status:</Text>
        <Text
          style={[
            styles.statusValue,
            { color: isCollecting ? "#4CAF50" : "#757575" },
          ]}
        >
          {getCollectionStatusText()}
        </Text>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefreshStatus}
        >
          <Text style={styles.refreshButtonText}>Refresh Status</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.verifyButton}
          onPress={handleVerifySession}
        >
          <Text style={styles.verifyButtonText}>Verify Session</Text>
        </TouchableOpacity>
      </View>

      {!hasUsagePermission && (
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={handleRequestUsagePermission}
        >
          <Text style={styles.buttonText}>Request Usage Permission</Text>
        </TouchableOpacity>
      )}

<TouchableOpacity
          style={styles.permissionButton}
          onPress={() => router.push("/survey")}
        >
          <Text style={styles.buttonText}>Survey Screen</Text>
        </TouchableOpacity>

      {!hasAccessibilityPermission && (
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={handleRequestAccessibilityPermission}
        >
          <Text style={styles.buttonText}>
            Request Accessibility Permission
          </Text>
        </TouchableOpacity>
      )}

      {hasUsagePermission && hasAccessibilityPermission && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.button,
              styles.startButton,
              (isCollecting ||
                !sessionInitialized ||
                userCreationStatus !== "session_initialized") &&
                styles.disabledButton,
            ]}
            onPress={handleStartCollection}
            disabled={
              isCollecting ||
              !sessionInitialized ||
              userCreationStatus !== "session_initialized"
            }
          >
            <Text style={styles.buttonText}>Start Hourly Collection</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.stopButton,
              !isCollecting && styles.disabledButton,
            ]}
            onPress={handleStopCollection}
            disabled={!isCollecting}
          >
            <Text style={styles.buttonText}>Stop Collection</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.infoText}>
        {!sessionInitialized || userCreationStatus !== "session_initialized"
          ? `${getUserCreationStatusText()}. Cannot collect data yet.`
          : hasUsagePermission && hasAccessibilityPermission
          ? `Ready to collect usage data every hour.${
              lastUploadTime
                ? `\nLast upload: ${formatLastUploadTime(lastUploadTime)}`
                : ""
            }${
              cachedDataCount > 0
                ? `\n${cachedDataCount} session${
                    cachedDataCount === 1 ? "" : "s"
                  } cached (will upload when online)`
                : ""
            }${
              isCollecting
                ? `\nNext collection: ${getNextCollectionTime()}`
                : ""
            }`
          : "Grant usage access permission to start collecting screen time data hourly."}
      </Text>

      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>
          Version {Constants.expoConfig?.version || "1.0.0"}
        </Text>
      </View>

      <SleepTimeModal
        visible={showSleepTimeModal}
        onSave={handleSaveSleepTime}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 18,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    position: "relative",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    color: "#333",
  },
  settingsButton: {
    position: "absolute",
    right: 0,
    padding: 8,
  },
  settingsButtonText: {
    fontSize: 24,
  },
  statusContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  statusValue: {
    fontSize: 14,
    fontWeight: "bold",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 8,
    gap: 10,
  },
  refreshButton: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 6,
    backgroundColor: "#FF9800",
  },
  refreshButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  verifyButton: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 6,
    backgroundColor: "#9C27B0",
  },
  verifyButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  buttonContainer: {
    marginTop: 15,
    gap: 12,
  },
  button: {
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: 8,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  permissionButton: {
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: 8,
    backgroundColor: "#2196F3",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    marginTop: 15,
  },
  startButton: {
    backgroundColor: "#4CAF50",
  },
  stopButton: {
    backgroundColor: "#F44336",
  },
  disabledButton: {
    backgroundColor: "#BDBDBD",
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "bold",
    textAlign: "center",
  },
  infoText: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    marginTop: 20,
    lineHeight: 18,
  },
  versionContainer: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  versionText: {
    fontSize: 11,
    color: "#999",
    textAlign: "center",
  },
});

export default App;
