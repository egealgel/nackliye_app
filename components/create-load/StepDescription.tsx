import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

const PRIMARY = '#FF6B35';

type Props = {
  description: string;
  onDescriptionChange: (description: string) => void;
  onNext: () => void;
  onSkip: () => void;
};

export default function StepDescription({
  description,
  onDescriptionChange,
  onNext,
  onSkip,
}: Props) {
  const hasText = description.trim().length > 0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Açıklama</Text>
      <Text style={styles.subtitle}>
        Yükünüz hakkında ek bilgi ekleyin (isteğe bağlı)
      </Text>

      <TextInput
        style={styles.textArea}
        value={description}
        onChangeText={onDescriptionChange}
        placeholder="Örn: Kırılacak malzeme var, dikkatli taşınması gerekiyor. Yükleme zamanı sabah 09:00..."
        placeholderTextColor="#9CA3AF"
        multiline
        numberOfLines={6}
        textAlignVertical="top"
        maxLength={500}
      />

      <Text style={styles.charCount}>{description.length}/500</Text>

      {hasText ? (
        <TouchableOpacity
          style={styles.nextButton}
          onPress={onNext}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>Devam Et</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.skipButton}
          onPress={onSkip}
          activeOpacity={0.7}
        >
          <Text style={styles.skipButtonText}>Atla →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 24,
  },
  textArea: {
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    color: '#1F2937',
    minHeight: 160,
    lineHeight: 24,
  },
  charCount: {
    textAlign: 'right',
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 6,
    marginBottom: 24,
  },
  nextButton: {
    backgroundColor: PRIMARY,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  skipButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#868e96',
  },
});
