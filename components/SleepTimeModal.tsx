import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface SleepTimeModalProps {
  visible: boolean;
  onSave: (bedtime: string) => void;
}

export const SleepTimeModal: React.FC<SleepTimeModalProps> = ({
  visible,
  onSave,
}) => {
  const [bedtime, setBedtime] = useState(new Date());
  const [showBedtimePicker, setShowBedtimePicker] = useState(false);

  // Initialize with default time (10 PM)
  React.useEffect(() => {
    const defaultBedtime = new Date();
    defaultBedtime.setHours(22, 0, 0, 0); // 10:00 PM
    setBedtime(defaultBedtime);
  }, []);

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatTimeForStorage = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const handleSave = () => {
    const bedtimeStr = formatTimeForStorage(bedtime);
    onSave(bedtimeStr);
  };

  const onBedtimeChange = (_event: any, selectedDate?: Date) => {
    setShowBedtimePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setBedtime(selectedDate);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.title}>When Do You Go To Bed?</Text>
          <Text style={styles.subtitle}>
            We&apos;ll send you the end-of-day survey notification before your bedtime
          </Text>

          {/* Bedtime Picker */}
          <View style={styles.timeSection}>
            <Text style={styles.label}>Bedtime</Text>
            <TouchableOpacity
              style={styles.timePicker}
              onPress={() => setShowBedtimePicker(true)}
            >
              <Text style={styles.timeText}>{formatTime(bedtime)}</Text>
            </TouchableOpacity>
            {showBedtimePicker && (
              <DateTimePicker
                value={bedtime}
                mode="time"
                is24Hour={false}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onBedtimeChange}
              />
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  timeSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  timePicker: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  timeText: {
    fontSize: 18,
    color: '#2196F3',
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonContainer: {
    marginTop: 8,
    gap: 12,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
