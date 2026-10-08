import { supabase } from "@/utils/supabase";
import { ensureUserExists, getOrCreateUserId, getUserId } from "@/utils/userId";
import { useForm } from "@tanstack/react-form";
import { router } from "expo-router";
import React from "react";
import {
  Alert,
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const EODSurveyPage: React.FC = () => {
  // Disable back button on mount
  React.useEffect(() => {
    // Disable Android hardware back button
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Return true to prevent default back behavior
      return true;
    });

    return () => backHandler.remove();
  }, []);
  
  const form = useForm({
    defaultValues: {
      sessionStart: '',
      sessionEnd: '',
      feeling: null as number | null,
      energyLevel: null as number | null,
    },
    onSubmit: async ({ value }) => {
      // Validate required fields
      if (
        !value.sessionStart.trim() ||
        !value.sessionEnd.trim() ||
        value.feeling === null ||
        value.energyLevel === null
      ) {
        Alert.alert("Incomplete", "Please answer all required questions.");
        return;
      }

      try {
        // Get user UUID and ensure user exists in database
        const userUuid = await getOrCreateUserId();
        await ensureUserExists(userUuid);
        
        // Get the database user ID
        const userId = await getUserId(userUuid);

        const eodData = {
          user_id: userId,
          session_start: value.sessionStart.trim(),
          session_end: value.sessionEnd.trim(),
          feel: value.feeling,
          energy: value.energyLevel,
          created_at: new Date().toISOString(),
        };

        console.log("Submitting EOD survey data:", eodData);

        // Save to Supabase
        const { error } = await supabase.from("eod_surveys").insert([eodData]);

        if (error) {
          console.error("Error saving EOD survey:", error);
          Alert.alert("Error", "Failed to save survey. Please try again.", [
            {
              text: "OK",
            },
          ]);
          return;
        }

        console.log("EOD survey saved successfully");
        
        Alert.alert("Success", "End-of-day survey submitted successfully!", [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]);
      } catch (error) {
        console.error("Error in EOD survey submission:", error);
        Alert.alert("Error", "An unexpected error occurred. Please try again.");
      }
    },
  });

  const getFeelingLabel = (value: number): string => {
    switch (value) {
      case 1:
        return 'Very unpleasant';
      case 2:
        return 'Unpleasant';
      case 3:
        return 'Slightly unpleasant';
      case 4:
        return 'Neutral';
      case 5:
        return 'Slightly pleasant';
      case 6:
        return 'Pleasant';
      case 7:
        return 'Very pleasant';
      default:
        return '';
    }
  };

  const getEnergyLabel = (value: number): string => {
    switch (value) {
      case 1:
        return 'Very calm';
      case 2:
        return '';
      case 3:
        return '';
      case 4:
        return '';
      case 5:
        return '';
      case 6:
        return '';
      case 7:
        return 'Very energized';
      default:
        return '';
    }
  };



  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.title}>End of Day Survey</Text>
        <Text style={styles.subtitle}>
          Reflect on your social media use today
        </Text>

        {/* Session Start Question */}
        <View style={styles.questionContainer}>
          <Text style={styles.questionText}>
            How did today's social media sessions usually start? *
          </Text>
          <form.Field name="sessionStart">
            {(field) => (
              <TextInput
                style={styles.textInput}
                placeholder="Describe how your sessions typically started..."
                value={field.state.value}
                onChangeText={field.handleChange}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            )}
          </form.Field>
        </View>

        {/* Session End Question */}
        <View style={styles.questionContainer}>
          <Text style={styles.questionText}>
            What usually ended or interrupted your sessions today? *
          </Text>
          <form.Field name="sessionEnd">
            {(field) => (
              <TextInput
                style={styles.textInput}
                placeholder="Describe what typically ended your sessions..."
                value={field.state.value}
                onChangeText={field.handleChange}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            )}
          </form.Field>
        </View>

        {/* Feeling Question */}
        <View style={styles.questionContainer}>
          <Text style={styles.questionText}>
            After using social media today, how did you usually feel? *
          </Text>

          <form.Field name="feeling">
            {(field) => (
              <View style={styles.likertContainer}>
                <View style={styles.likertLabels}>
                  {[1, 2, 3, 4, 5, 6, 7].map((value) => (
                    <TouchableOpacity
                      key={value}
                      style={[
                        styles.likertOption,
                        field.state.value === value && styles.likertOptionSelected,
                      ]}
                      onPress={() => field.handleChange(value)}
                    >
                      <Text
                        style={[
                          styles.likertNumber,
                          field.state.value === value && styles.likertNumberSelected,
                        ]}
                      >
                        {value}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                
                <View style={styles.likertTextLabels}>
                  <Text style={styles.likertTextLabel}>Very{'\n'}unpleasant</Text>
                  <Text style={styles.likertTextLabel}></Text>
                  <Text style={styles.likertTextLabel}></Text>
                  <Text style={styles.likertTextLabel}></Text>
                  <Text style={styles.likertTextLabel}></Text>
                  <Text style={styles.likertTextLabel}></Text>
                  <Text style={styles.likertTextLabel}>Very{'\n'}pleasant</Text>
                </View>
                

              </View>
            )}
          </form.Field>
        </View>

        {/* Energy Level Question */}
        <View style={styles.questionContainer}>
          <Text style={styles.questionText}>
            Energy level afterward? *
          </Text>

          <form.Field name="energyLevel">
            {(field) => (
              <View style={styles.likertContainer}>
                <View style={styles.likertLabels}>
                  {[1, 2, 3, 4, 5, 6, 7].map((value) => (
                    <TouchableOpacity
                      key={value}
                      style={[
                        styles.likertOption,
                        field.state.value === value && styles.likertOptionSelected,
                      ]}
                      onPress={() => field.handleChange(value)}
                    >
                      <Text
                        style={[
                          styles.likertNumber,
                          field.state.value === value && styles.likertNumberSelected,
                        ]}
                      >
                        {value}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                
                <View style={styles.likertTextLabels}>
                  <Text style={styles.likertTextLabel}>Very calm</Text>
                  <Text style={styles.likertTextLabel}></Text>
                  <Text style={styles.likertTextLabel}></Text>
                  <Text style={styles.likertTextLabel}></Text>
                  <Text style={styles.likertTextLabel}></Text>
                  <Text style={styles.likertTextLabel}></Text>
                  <Text style={styles.likertTextLabel}>Very energized</Text>
                </View>
                

              </View>
            )}
          </form.Field>
        </View>

        {/* Submit Button */}
        <form.Subscribe
          selector={(state) => [
            state.canSubmit, 
            state.isSubmitting,
            state.values.sessionStart?.trim().length > 0,
            state.values.sessionEnd?.trim().length > 0,
            state.values.feeling !== null,
            state.values.energyLevel !== null
          ]}
        >
          {([canSubmit, isSubmitting, startValid, endValid, feelingValid, energyValid]) => {
            const isValid = startValid && endValid && feelingValid && energyValid;
            return (
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!canSubmit || !isValid) && styles.submitButtonDisabled,
                ]}
                onPress={form.handleSubmit}
                disabled={!canSubmit || !isValid || isSubmitting}
              >
                <Text style={styles.submitButtonText}>
                  {isSubmitting ? "Submitting..." : "Submit End of Day Survey"}
                </Text>
              </TouchableOpacity>
            );
          }}
        </form.Subscribe>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
    color: "#333",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 30,
    color: "#666",
  },
  questionContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  questionText: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 15,
    color: "#333",
    lineHeight: 24,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
    minHeight: 80,
    lineHeight: 22,
  },
  likertContainer: {
    marginTop: 10,
  },
  likertLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  likertOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  likertOptionSelected: {
    borderColor: "#4CAF50",
    backgroundColor: "#E8F5E8",
  },
  likertNumber: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
  likertNumberSelected: {
    color: "#4CAF50",
  },
  likertTextLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  likertTextLabel: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    flex: 1,
  },

  submitButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonDisabled: {
    backgroundColor: "#BDBDBD",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
});

export default EODSurveyPage;