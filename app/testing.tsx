import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Platform,
} from "react-native";
import { sendTestNotification, getAllScheduledNotifications } from "@/utils/notifications";
import { supabase } from "@/utils/supabase";
import { getOrCreateUserId } from "@/utils/userId";
import * as Notifications from "expo-notifications";
import { ArrowLeft, RotateCw } from "lucide-react-native";

interface UserData {
  id: number;
  uuid: string;
  push_token: string | null;
  sleep_time: string | null;
  created_at: string;
}

const TestingPage: React.FC = () => {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [scheduledNotifications, setScheduledNotifications] = useState<Notifications.NotificationRequest[]>([]);

  useEffect(() => {
    loadUserData();
    loadScheduledNotifications();
  }, []);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const uuid = await getOrCreateUserId();
      
      const { data, error } = await supabase
        .from("users_screentime")
        .select("*")
        .eq("uuid", uuid)
        .single();

      if (error) {
        console.error("Error fetching user data:", error);
        Alert.alert("Error", "Failed to fetch user data from Supabase");
        return;
      }

      setUserData(data);
    } catch (error) {
      console.error("Error loading user data:", error);
      Alert.alert("Error", "Failed to load user data");
    } finally {
      setLoading(false);
    }
  };

  const loadScheduledNotifications = async () => {
    try {
      const notifications = await getAllScheduledNotifications();
      setScheduledNotifications(notifications);
    } catch (error) {
      console.error("Error loading scheduled notifications:", error);
    }
  };

  const handleTestNotification = async () => {
    const success = await sendTestNotification();
    if (success) {
      Alert.alert(
        "Test Notification Scheduled",
        "You will receive a test notification in 2 seconds."
      );
    } else {
      Alert.alert(
        "Error",
        "Failed to schedule test notification. Please check notification permissions."
      );
    }
  };

  const handleRefresh = () => {
    loadUserData();
    loadScheduledNotifications();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading user data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Testing & Debug</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
        >
          <RotateCw size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <TouchableOpacity
            style={styles.testButton}
            onPress={handleTestNotification}
          >
            <Text style={styles.testButtonText}>Send Test Notification</Text>
          </TouchableOpacity>

          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Scheduled Notifications:</Text>
            <Text style={styles.infoValue}>
              {scheduledNotifications.length} notification{scheduledNotifications.length !== 1 ? "s" : ""}
            </Text>
            {scheduledNotifications.map((notification, index) => (
              <View key={notification.identifier} style={styles.notificationItem}>
                <Text style={styles.notificationText}>
                  {index + 1}. {notification.content.title}
                </Text>
                <Text style={styles.notificationTime}>
                  {notification.trigger && 'date' in notification.trigger
                    ? new Date(notification.trigger.date).toLocaleString()
                    : 'No date'}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>User Data (Supabase)</Text>
          {userData ? (
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>UUID:</Text>
                <Text style={[styles.infoValue, styles.monoText]}>
                  {userData.uuid}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Push Token:</Text>
                <Text style={[styles.infoValue, styles.monoText]}>
                  {userData.push_token ? userData.push_token.substring(0, 50) + "..." : "Not set"}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Sleep Time:</Text>
                <Text style={styles.infoValue}>
                  {userData.sleep_time || "Not set"}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Created At:</Text>
                <Text style={styles.infoValue}>
                  {new Date(userData.created_at).toLocaleString()}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.noDataText}>No user data found</Text>
          )}
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    paddingTop: 50,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
    textAlign: "center",
  },
  backButton: {
    padding: 8,
    backgroundColor: "#fff",
    borderRadius: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshButton: {
    padding: 8,
    backgroundColor: "#fff",
    borderRadius: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 18,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  testButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    marginBottom: 12,
  },
  testButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "bold",
    textAlign: "center",
  },
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  infoRow: {
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  infoValue: {
    fontSize: 14,
    color: "#333",
    flexWrap: "wrap",
  },
  monoText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 12,
  },
  noDataText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    padding: 20,
  },
  loadingText: {
    fontSize: 14,
    color: "#666",
    marginTop: 12,
  },
  notificationItem: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  notificationText: {
    fontSize: 13,
    color: "#333",
    fontWeight: "500",
  },
  notificationTime: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  bottomPadding: {
    height: 40,
  },
});

export default TestingPage;
