import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { Platform } from "react-native";
import { supabase } from "./supabase";

export async function sendPushNotification(expoPushToken: string) {
  const message = {
    to: expoPushToken,
    sound: "default",
    title: "Original Title",
    body: "And here is the body!",
    data: { someData: "goes here" },
  };

  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });
}

function handleRegistrationError(errorMessage: string) {
  alert(errorMessage);
  throw new Error(errorMessage);
}

export async function handleDeeplink(url: string) {
  if (!url) {
    console.error(
      "Deep Linking Error: URL is undefined or empty, navigating to home"
    );
    router.push("/");
    return;
  }

  try {
    // Check if it's an external URL (http:// or https://)
    if (url.startsWith("http://") || url.startsWith("https://")) {
      console.log("Opening external URL:", url);
      await WebBrowser.openBrowserAsync(url);
      return;
    }

    // Handle internal deep links
    // Remove the scheme to get just the path
    const urlWithoutScheme = url.replace(/^[^:]+:\/\//, "");
    const [path] = urlWithoutScheme.split("?");

    if (path === "survey") {
      router.push("/survey");
    } else if (path === "eod") {
      router.push("/eod");
    } else {
      // Unknown path, go to home
      console.log("Unknown path, navigating to home");
      router.push("/");
    }
  } catch (error) {
    console.error("Error parsing deep link:", error);
    router.push("/");
  }
}

export async function registerForPushNotificationsAsync() {
  if (Platform.OS === "android") {
    // Set up default channel for Android 8.0+ (no-op on Android 7 and below)
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
      sound: "default", // Sound for Android 8.0+
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      handleRegistrationError(
        "Permission not granted to get push token for push notification!"
      );
      return;
    }
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;
    if (!projectId) {
      handleRegistrationError("Project ID not found");
    }
    try {
      const pushTokenString = (
        await Notifications.getExpoPushTokenAsync({
          projectId,
        })
      ).data;
      console.log(pushTokenString);
      return pushTokenString;
    } catch (e: unknown) {
      handleRegistrationError(`${e}`);
    }
  } else {
    handleRegistrationError("Must use physical device for push notifications");
  }
}

export async function updatePushTokenInDatabase(
  uuid: string,
  pushToken: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("users_screentime")
      .update({ push_token: pushToken })
      .eq("uuid", uuid);

    if (error) {
      console.error("Push token update error:", error);
      return false;
    }

    console.log("Push token updated in database successfully");
    return true;
  } catch (error) {
    console.error("Error updating push token:", error);
    return false;
  }
}

export async function scheduleDailyNotification(
  hour: number,
  minute: number
): Promise<string[]> {
  try {
    // Cancel any existing daily notifications
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Set up notification channel for Android 8.0+ (no-op on Android 7 and below)
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Daily Surveys",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: "default",
        lightColor: "#FF231F7C",
      });
    }

    const notificationIds: string[] = [];

    // Schedule 7 notifications, one for each day
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const notificationTime = new Date();
      notificationTime.setHours(hour, minute, 0, 0);
      
      // Add days to the notification time
      notificationTime.setDate(notificationTime.getDate() + dayOffset);

      // If the time has already passed today, skip day 0 and start from tomorrow
      if (dayOffset === 0 && notificationTime.getTime() < Date.now()) {
        continue;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: "End of Day Survey",
          body: "Take a moment to reflect on your social media use today",
          data: { url: "https://mit.co1.qualtrics.com/jfe/form/SV_a9x3wnEMkCDq1vM" },
          // Properties for Android < 8.0 (ignored on Android 8.0+)
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          vibrate: [0, 250, 250, 250],
          color: "#FF231F7C",
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: notificationTime,
          // Channel ID for Android 8.0+ (ignored on Android < 8.0)
          channelId: "default",
        },
      });

      notificationIds.push(notificationId);
      
      console.log(
        `Notification ${dayOffset + 1}/7 scheduled for`,
        notificationTime.toLocaleString()
      );
    }

    console.log(`Successfully scheduled ${notificationIds.length} notifications`);
    return notificationIds;
  } catch (error) {
    console.error("Error scheduling notifications:", error);
    return [];
  }
}

export async function getAllScheduledNotifications(): Promise<
  Notifications.NotificationRequest[]
> {
  try {
    const scheduledNotifications =
      await Notifications.getAllScheduledNotificationsAsync();
    return scheduledNotifications;
  } catch (error) {
    console.error("Error getting scheduled notifications:", error);
    return [];
  }
}

export async function sendTestNotification(): Promise<boolean> {
  try {
    // Set up channel for Android 8.0+ (no-op on Android 7 and below)
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Test Notifications",
        importance: Notifications.AndroidImportance.HIGH,
        sound: "default",
      });
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Test Notification",
        body: "This is a test end-of-day survey notification",
        data: { url: "https://mit.co1.qualtrics.com/jfe/form/SV_a9x3wnEMkCDq1vM" },
        // Properties for Android < 8.0 (ignored on Android 8.0+)
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 2,
        // Channel ID for Android 8.0+ (ignored on Android < 8.0)
        channelId: "default",
      },
    });
    console.log("Test notification scheduled for 2 seconds from now");
    return true;
  } catch (error) {
    console.error("Error sending test notification:", error);
    return false;
  }
}
