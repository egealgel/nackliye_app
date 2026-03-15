import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { formatWeight } from '@/types/load';

const PRIMARY = '#2563EB';

const QUICK_OPTIONS = [
  { label: '100 kg', value: 100 },
  { label: '500 kg', value: 500 },
  { label: '1 ton', value: 1000 },
  { label: '5 ton', value: 5000 },
  { label: '10 ton', value: 10000 },
  { label: '20 ton', value: 20000 },
];

type Props = {
  weight: number;
  onWeightChange: (weight: number) => void;
  onNext: () => void;
};

export default function StepWeight({ weight, onWeightChange, onNext }: Props) {
  const [inputValue, setInputValue] = useState(weight > 0 ? String(weight) : '');

  const handleInputChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setInputValue(cleaned);
    const num = parseInt(cleaned, 10);
    onWeightChange(isNaN(num) ? 0 : num);
  };

  const handleQuickSelect = (value: number) => {
    setInputValue(String(value));
    onWeightChange(value);
  };

  const currentWeight = parseInt(inputValue, 10) || 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
    >
      <Text style={styles.title}>Kaç kilo?</Text>
      <Text style={styles.subtitle}>Yükünüzün ağırlığını girin</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputValue}
          onChangeText={handleInputChange}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor="#D1D5DB"
          maxLength={6}
        />
        <Text style={styles.unit}>kg</Text>
      </View>

      {currentWeight > 0 && (
        <Text style={styles.converted}>{formatWeight(currentWeight)}</Text>
      )}

      <Text style={styles.quickLabel}>Hızlı seçim</Text>
      <View style={styles.quickGrid}>
        {QUICK_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.quickButton,
              currentWeight === opt.value && styles.quickButtonActive,
            ]}
            onPress={() => handleQuickSelect(opt.value)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.quickButtonText,
                currentWeight === opt.value && styles.quickButtonTextActive,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.nextButton, currentWeight <= 0 && styles.nextButtonDisabled]}
        onPress={onNext}
        disabled={currentWeight <= 0}
        activeOpacity={0.8}
      >
        <Text style={styles.nextButtonText}>Devam Et</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 8,
  },
  input: {
    fontSize: 56,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    paddingVertical: 8,
    minWidth: 80,
  },
  unit: {
    fontSize: 28,
    fontWeight: '600',
    color: '#9CA3AF',
    marginLeft: 4,
  },
  converted: {
    textAlign: 'center',
    fontSize: 16,
    color: PRIMARY,
    fontWeight: '500',
    marginBottom: 32,
  },
  quickLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 32,
  },
  quickButton: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    minWidth: '30%',
    alignItems: 'center',
  },
  quickButtonActive: {
    backgroundColor: PRIMARY,
  },
  quickButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  quickButtonTextActive: {
    color: '#FFFFFF',
  },
  nextButton: {
    backgroundColor: PRIMARY,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  nextButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
