import * as SecureStore from "expo-secure-store";
import uuid from "react-native-uuid";
import { supabase } from "./supabase";

const USER_ID_KEY = "user-id-screentime";

export async function getOrCreateUserId() {
  let userId = await SecureStore.getItemAsync(USER_ID_KEY);
  if (!userId) {
    userId = uuid.v4();
    await SecureStore.setItemAsync(USER_ID_KEY, userId);
  }
  return userId;
}

export async function ensureUserExists(userId: string, pushToken?: string) {
  const { data: existingUser, error: selectError } = await supabase
    .from("users_screentime")
    .select("uuid, push_token")
    .eq("uuid", userId)
    .single();

  if (selectError && selectError.code !== "PGRST116") {
    console.error("User lookup error:", selectError);
    return;
  }

  // If user doesn't exist, insert them with push token
  if (!existingUser) {
    const { error: insertError } = await supabase
      .from("users_screentime")
      .insert([{ uuid: userId, push_token: pushToken }]);

    if (insertError) {
      console.error("User creation error:", insertError);
    }
    console.log("User created with push token:", pushToken ? "Yes" : "No");
  } else if (pushToken && existingUser.push_token !== pushToken) {
    // If user exists but push token is different, update it
    const { error: updateError } = await supabase
      .from("users_screentime")
      .update({ push_token: pushToken })
      .eq("uuid", userId);

    if (updateError) {
      console.error("Push token update error:", updateError);
    } else {
      console.log("Push token updated for existing user");
    }
  }
}

// get id that is referenced
export async function getUserId(userId: string) {
  const { data: userData, error: userError } = await supabase
    .from("users_screentime")
    .select("id")
    .eq("uuid", userId)
    .single();

  if (userError) {
    console.error("User Id Error", userError);
    throw new Error("Error Getting User ID");
  }

  return userData.id;
}

export async function updateUserPushToken(pushToken: string) {}

const SLEEP_TIME_KEY = "sleep-time-preference";

export async function getSleepTimePreference(): Promise<string | null> {
  return await SecureStore.getItemAsync(SLEEP_TIME_KEY);
}

export async function setSleepTimePreference(sleepTime: string): Promise<void> {
  await SecureStore.setItemAsync(SLEEP_TIME_KEY, sleepTime);
}

export async function updateUserSleepTime(userId: string, sleepTime: string): Promise<void> {
  const { error } = await supabase
    .from("users_screentime")
    .update({ sleep_time: sleepTime })
    .eq("uuid", userId);

  if (error) {
    console.error("Sleep time update error:", error);
    throw error;
  }

  await setSleepTimePreference(sleepTime);
  console.log("Sleep time updated successfully");
}
