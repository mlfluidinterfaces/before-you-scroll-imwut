import { getUserId } from "@/utils/userId";
import { Alert, Linking, NativeModules } from "react-native";

interface ScreenTimeModuleInterface {
  checkUsagePermission(): Promise<boolean>;
  checkWorkManagerStatus(): Promise<boolean>;
  checkAccessibilityServicePermissions(): Promise<boolean>;
  startUsageStatsCollection(): Promise<string>;
  stopUsageStatsCollection(): Promise<string>;
  setUserUuid(uuid: string): Promise<string>;
  getUserUuid(): Promise<string>;
  setUserId(userId: string): Promise<string>;
  getUserId(): Promise<string>;
  setSupabaseCredentials(url: string, anonKey: string): Promise<string>;
  getLastUploadTime(): Promise<number>;
  getCachedDataCount(): Promise<number>;
  clearCachedData(): Promise<string>;
  getLastPollTime(): Promise<number>;
  openUsageAccessSettings(): Promise<string>;
  openAccessibilityServiceSettings(): Promise<string>;
}

interface ServiceResponse {
  success: boolean;
  message: string;
}

const { ScreenTimeModule } = NativeModules as {
  ScreenTimeModule: ScreenTimeModuleInterface;
};

class ScreenTimeService {
  // Set user UUID in native SharedPreferences
  static async setUserUuid(uuid: string): Promise<ServiceResponse> {
    try {
      const result: string = await ScreenTimeModule.setUserUuid(uuid);
      console.log("UUID stored in native:", result);
      return { success: true, message: result };
    } catch (error: any) {
      console.error("Error storing UUID in native:", error);
      return {
        success: false,
        message: error.message || "Failed to store UUID",
      };
    }
  }

  // Set user ID in native SharedPreferences
  static async setUserId(userId: string): Promise<ServiceResponse> {
    try {
      const result: string = await ScreenTimeModule.setUserId(userId);
      console.log("User ID stored in native:", result);
      return { success: true, message: result };
    } catch (error: any) {
      console.error("Error storing User ID in native:", error);
      return {
        success: false,
        message: error.message || "Failed to store User ID",
      };
    }
  }

  // Get user UUID from native SharedPreferences
  static async getUserUuid(): Promise<{
    success: boolean;
    uuid?: string;
    message: string;
  }> {
    try {
      const uuid: string = await ScreenTimeModule.getUserUuid();
      console.log("Retrieved UUID from native:", uuid);
      return { success: true, uuid, message: "UUID retrieved successfully" };
    } catch (error: any) {
      console.error("Error retrieving UUID from native:", error);
      return {
        success: false,
        message: error.message || "Failed to retrieve UUID",
      };
    }
  }

  // Get user ID from native SharedPreferences
  static async getUserId(): Promise<{
    success: boolean;
    userId?: string;
    message: string;
  }> {
    try {
      const userId: string = await ScreenTimeModule.getUserId();
      console.log("Retrieved User ID from native:", userId);
      return {
        success: true,
        userId,
        message: "User ID retrieved successfully",
      };
    } catch (error: any) {
      console.error("Error retrieving User ID from native:", error);
      return {
        success: false,
        message: error.message || "Failed to retrieve User ID",
      };
    }
  }

  // Set Supabase credentials from React Native .env
  static async setSupabaseCredentials(
    url: string,
    anonKey: string
  ): Promise<ServiceResponse> {
    try {
      const result: string = await ScreenTimeModule.setSupabaseCredentials(
        url,
        anonKey
      );
      console.log("Supabase credentials stored:", result);
      return { success: true, message: result };
    } catch (error: any) {
      console.error("Error storing Supabase credentials:", error);
      return {
        success: false,
        message: error.message || "Failed to store Supabase credentials",
      };
    }
  }

  // Get last successful upload time
  static async getLastUploadTime(): Promise<{
    success: boolean;
    timestamp?: number;
    message: string;
  }> {
    try {
      const timestamp: number = await ScreenTimeModule.getLastUploadTime();
      return {
        success: true,
        timestamp,
        message: "Last upload time retrieved",
      };
    } catch (error: any) {
      console.error("Error getting last upload time:", error);
      return {
        success: false,
        message: error.message || "Failed to get last upload time",
      };
    }
  }

  // Get cached data count
  static async getCachedDataCount(): Promise<{
    success: boolean;
    count?: number;
    message: string;
  }> {
    try {
      const count: number = await ScreenTimeModule.getCachedDataCount();
      return {
        success: true,
        count,
        message: "Cached data count retrieved",
      };
    } catch (error: any) {
      console.error("Error getting cached data count:", error);
      return {
        success: false,
        message: error.message || "Failed to get cached data count",
      };
    }
  }

  // Clear cached data
  static async clearCachedData(): Promise<ServiceResponse> {
    try {
      const result: string = await ScreenTimeModule.clearCachedData();
      console.log("Cached data cleared:", result);
      return { success: true, message: result };
    } catch (error: any) {
      console.error("Error clearing cached data:", error);
      return {
        success: false,
        message: error.message || "Failed to clear cached data",
      };
    }
  }

  // Get last polling time (including cache)
  static async getLastPollTime(): Promise<{
    success: boolean;
    timestamp?: number;
    message: string;
  }> {
    try {
      const timestamp: number = await ScreenTimeModule.getLastPollTime();
      return {
        success: true,
        timestamp,
        message: "Last poll time retrieved",
      };
    } catch (error: any) {
      console.error("Error getting last poll time:", error);
      return {
        success: false,
        message: error.message || "Failed to get last poll time",
      };
    }
  }

  // Initialize user session - gets UUID, fetches user ID from Supabase, stores both natively, and sets up Supabase credentials
  static async initializeUserSession(
    uuid: string,
    supabaseUrl: string,
    supabaseAnonKey: string
  ): Promise<ServiceResponse> {
    try {
      // Store Supabase credentials first
      const credentialsResult = await this.setSupabaseCredentials(
        supabaseUrl,
        supabaseAnonKey
      );
      if (!credentialsResult.success) {
        return credentialsResult;
      }

      // Store UUID
      const uuidResult = await this.setUserUuid(uuid);
      if (!uuidResult.success) {
        return uuidResult;
      }

      // Get user ID from Supabase
      const userId = await getUserId(uuid);

      // Store user ID natively
      const userIdResult = await this.setUserId(userId.toString());
      if (!userIdResult.success) {
        return userIdResult;
      }

      return {
        success: true,
        message: `User session initialized. UUID: ${uuid}, User ID: ${userId}`,
      };
    } catch (error: any) {
      console.error("Error initializing user session:", error);
      return {
        success: false,
        message: error.message || "Failed to initialize user session",
      };
    }
  }

  // Check if usage access permission is granted
  static async checkUsagePermission(): Promise<boolean> {
    try {
      const hasPermission: boolean =
        await ScreenTimeModule.checkUsagePermission();
      return hasPermission;
    } catch (error) {
      console.error("Error checking usage permission:", error);
      return false;
    }
  }

  // Check collection status (WorkManager only)
  static async checkWorkManagerStatus(): Promise<boolean> {
    try {
      const isRunning: boolean =
        await ScreenTimeModule.checkWorkManagerStatus();
      return isRunning;
    } catch (error) {
      console.error("Error checking WorkManager status:", error);
      return false;
    }
  }

  // Request usage access permission (opens system settings)
  static requestUsagePermission(): void {
    Alert.alert(
      "Usage Access Required",
      "This app needs usage access permission to track screen time. You will be redirected to the Usage Access settings.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Open Settings",
          onPress: async (): Promise<void> => {
            try {
              // Use native method to open Usage Access settings
              await ScreenTimeModule.openUsageAccessSettings();
            } catch (error) {
              console.error("Failed to open usage access settings:", error);
              // Fallback to Linking if native method fails
              Linking.openSettings();
            }
          },
        },
      ]
    );
  }

  // Check if usage access permission is granted
  static async checkAccessibilityServicePermission(): Promise<boolean> {
    try {
      const hasPermission: boolean =
        await ScreenTimeModule.checkAccessibilityServicePermissions();
      return hasPermission;
    } catch (error) {
      console.error("Error checking usage permission:", error);
      return false;
    }
  }

  // Request usage access permission (opens system settings)
  static requestAccessibilityServicePermission(): void {
    Alert.alert(
      "Accessibility Service Access Required",
      "This app needs accessibility service access permission to send surveys. You will be redirected to the Accessibility Service Access settings.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Open Settings",
          onPress: async (): Promise<void> => {
            try {
              // Use native method to open Usage Access settings
              await ScreenTimeModule.openAccessibilityServiceSettings();
            } catch (error) {
              console.error("Failed to open usage access settings:", error);
              // Fallback to Linking if native method fails
              Linking.openSettings();
            }
          },
        },
      ]
    );
  }

  // Start usage stats collection with WorkManager
  static async startUsageStatsCollection(): Promise<ServiceResponse> {
    try {
      // First check if we have permission
      const hasPermission: boolean = await this.checkUsagePermission();

      if (!hasPermission) {
        this.requestUsagePermission();
        return { success: false, message: "Permission required" };
      }

      const result: string = await ScreenTimeModule.startUsageStatsCollection();
      console.log("Usage stats collection started:", result);
      return { success: true, message: result };
    } catch (error: any) {
      console.error("Error starting usage stats collection:", error);
      return {
        success: false,
        message: error.message || "Unknown error occurred",
      };
    }
  }

  // Stop usage stats collection
  static async stopUsageStatsCollection(): Promise<ServiceResponse> {
    try {
      const result: string = await ScreenTimeModule.stopUsageStatsCollection();
      console.log("Usage stats collection stopped:", result);
      return { success: true, message: result };
    } catch (error: any) {
      console.error("Error stopping usage stats collection:", error);
      return {
        success: false,
        message: error.message || "Unknown error occurred",
      };
    }
  }

  // Show cache management options
  static showCacheManagement(cachedCount: number): void {
    if (cachedCount === 0) {
      Alert.alert("Cache Status", "No cached data found.");
      return;
    }

    Alert.alert(
      "Cached Data",
      `You have ${cachedCount} cached session${
        cachedCount === 1 ? "" : "s"
      } waiting to be uploaded.\n\nThis data will be automatically uploaded when the connection is restored.`,
      [
        {
          text: "Clear Cache",
          style: "destructive",
          onPress: async () => {
            const result = await this.clearCachedData();
            Alert.alert(result.success ? "Success" : "Error", result.message);
          },
        },
        {
          text: "OK",
          style: "cancel",
        },
      ]
    );
  }
}

export default ScreenTimeService;
