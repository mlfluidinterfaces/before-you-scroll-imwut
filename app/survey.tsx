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
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const SurveyPage: React.FC = () => {
  // Disable back button on mount and reset form
  React.useEffect(() => {
    // Reset form to clear previous survey choices
    form.reset();
    
    // Disable Android hardware back button
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Return true to prevent default back behavior
      return true;
    });

    return () => backHandler.remove();
  }, []);
  
  const form = useForm({
    defaultValues: {
      regret: null as number | null,
      timeComparison: null as number | null,
      meaningfulness: null as number | null,
    },
    onSubmit: async ({ value }) => {
      if (value.regret === null || value.timeComparison === null || value.meaningfulness === null) {
        Alert.alert("Incomplete", "Please answer all required questions.");
        return;
      }

      try {
        // Get user UUID and ensure user exists in database
        const userUuid = await getOrCreateUserId();
        await ensureUserExists(userUuid);
        
        // Get the database user ID
        const userId = await getUserId(userUuid);

        const surveyData = {
          user_id: userId,
          regret: value.regret,
          time_comparison: value.timeComparison,
          meaningfulness: value.meaningfulness,
          created_at: new Date().toISOString(),
        };

        console.log("Submitting survey data:", surveyData);

        // Save to Supabase
        const { error } = await supabase
          .from("session_surveys")
          .insert([surveyData]);

        if (error) {
          console.error("Error saving survey:", error);
          Alert.alert("Error", "Failed to save survey. Please try again.", [
            {
              text: "OK",
            },
          ]);
          return;
        }

        console.log("Survey saved successfully");
        
        Alert.alert("Survey Submitted", "Thank you for your feedback!", [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]);
      } catch (error) {
        console.error("Error submitting survey:", error);
        Alert.alert("Error", "Failed to submit survey. Please try again.", [
          {
            text: "OK",
          },
        ]);
      }
    },
  });

  const getRegretLabel = (value: number): string => {
    switch (value) {
      case 1:
        return 'Strongly Disagree';
      case 2:
        return 'Disagree';
      case 3:
        return 'Somewhat Disagree';
      case 4:
        return 'Neutral';
      case 5:
        return 'Somewhat Agree';
      case 6:
        return 'Agree';
      case 7:
        return 'Strongly Agree';
      default:
        return '';
    }
  };



  const getTimeComparisonLabel = (value: number): string => {
    switch (value) {
      case 1:
        return 'Much less';
      case 2:
        return '';
      case 3:
        return '';
      case 4:
        return 'Neutral';
      case 5:
        return '';
      case 6:
        return '';
      case 7:
        return 'Much more';
      default:
        return '';
    }
  };

  const getMeaningfulnessLabel = (value: number): string => {
    switch (value) {
      case 1:
        return 'Not at all meaningful';
      case 2:
        return '';
      case 3:
        return '';
      case 4:
        return 'Neutral';
      case 5:
        return '';
      case 6:
        return '';
      case 7:
        return 'Very meaningful';
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
        <Text style={styles.title}>Session Survey</Text>


        {/* Regret Question */}
        <View style={styles.questionContainer}>
          <Text style={styles.statementText}>
            "I feel regret about this phone use session."
          </Text>

          <form.Field name="regret">
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
                  <Text style={styles.likertTextLabel}>Strongly{'\n'}Disagree</Text>
                  <Text style={styles.likertTextLabel}></Text>
                  <Text style={styles.likertTextLabel}></Text>
                  <Text style={styles.likertTextLabel}></Text>
                  <Text style={styles.likertTextLabel}></Text>
                  <Text style={styles.likertTextLabel}></Text>
                  <Text style={styles.likertTextLabel}>Strongly{'\n'}Agree</Text>
                </View>
                

              </View>
            )}
          </form.Field>
        </View>

        {/* Time Comparison Question */}
        <View style={styles.questionContainer}>
          <Text style={styles.statementText}>
          Compared with what you had intended before this session started, did you spend
          </Text>

          <form.Field name="timeComparison">
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
                  <Text style={styles.likertTextLabel}>Much{'\n'}Less</Text>
                  <Text style={styles.likertTextLabel}></Text>
                  <Text style={styles.likertTextLabel}></Text>
                  <Text style={styles.likertTextLabel}>As{'\n'}much</Text>
                  <Text style={styles.likertTextLabel}></Text>
                  <Text style={styles.likertTextLabel}></Text>
                  <Text style={styles.likertTextLabel}>Much{'\n'}More</Text>
                </View>
              </View>
            )}
          </form.Field>
        </View>

        {/* Meaningfulness Question */}
        <View style={styles.questionContainer}>
          <Text style={styles.statementText}>
            How much do you feel like you have spent your time on something meaningful?
          </Text>

          <form.Field name="meaningfulness">
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
                  <Text style={styles.likertTextLbl}>Not at all{'\n'}meaningful</Text>
                  <Text style={styles.likertTextLabel}></Text>
                  <Text style={styles.likertTextLabel}></Text>
                  <Text style={styles.likertTextLabel}></Text>
                  <Text style={styles.likertTextLabel}></Text>
                  <Text style={styles.likertTextLabel}></Text>
                  <Text style={styles.likertTextLbl}>Very{'\n'}meaningful</Text>
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
            state.values.regret !== null,
            state.values.timeComparison !== null,
            state.values.meaningfulness !== null
          ]}
        >
          {([canSubmit, isSubmitting, regretValid, timeValid, meaningfulValid]) => {
            const isValid = regretValid && timeValid && meaningfulValid;
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
                  {isSubmitting ? "Submitting..." : "Submit Survey"}
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
    padding: 10,
    paddingBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 16,
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
    padding: 10,
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
  statementText: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 20,
    color: "#555",
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
    fontSize: 10,
    color: "#666",
    textAlign: "center",
  },
  likertTextLbl:{
    fontSize: 9,
    color: "#666",
    textAlign: "center",
  },

  radioContainer: {
    gap: 12,
  },
  radioOption: {
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    backgroundColor: "#fff",
    alignItems: "flex-start",
  },
  radioOptionSelected: {
    borderColor: "#4CAF50",
    backgroundColor: "#E8F5E8",
  },
  radioText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#666",
    lineHeight: 22,
  },
  radioTextSelected: {
    color: "#4CAF50",
    fontWeight: "600",
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

export default SurveyPage;