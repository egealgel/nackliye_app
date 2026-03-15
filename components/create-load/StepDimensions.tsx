import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';

const PRIMARY = '#2563EB';

type Props = {
  width?: number;
  length?: number;
  height?: number;
  onDimensionsChange: (dims: {
    width?: number;
    length?: number;
    height?: number;
  }) => void;
  onNext: () => void;
  onSkip: () => void;
};

export default function StepDimensions({
  width,
  length,
  height,
  onDimensionsChange,
  onNext,
  onSkip,
}: Props) {
  const [w, setW] = useState(width ? String(width) : '');
  const [l, setL] = useState(length ? String(length) : '');
  const [h, setH] = useState(height ? String(height) : '');

  const parseNum = (val: string): number | undefined => {
    const n = parseInt(val, 10);
    return isNaN(n) || n <= 0 ? undefined : n;
  };

  const handleChange = (field: 'w' | 'l' | 'h', text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (field === 'w') setW(cleaned);
    if (field === 'l') setL(cleaned);
    if (field === 'h') setH(cleaned);

    const newW = field === 'w' ? cleaned : w;
    const newL = field === 'l' ? cleaned : l;
    const newH = field === 'h' ? cleaned : h;

    onDimensionsChange({
      width: parseNum(newW),
      length: parseNum(newL),
      height: parseNum(newH),
    });
  };

  const hasAnyDimension = parseNum(w) || parseNum(l) || parseNum(h);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
    >
      <Text style={styles.title}>Boyut</Text>
      <Text style={styles.subtitle}>
        Yükünüzün boyutlarını girin (isteğe bağlı)
      </Text>

      <View style={styles.dimensionsRow}>
        <View style={styles.dimensionInput}>
          <Text style={styles.dimensionLabel}>En</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              value={w}
              onChangeText={(t) => handleChange('w', t)}
              keyboardType="numeric"
              placeholder="—"
              placeholderTextColor="#D1D5DB"
              maxLength={4}
            />
            <Text style={styles.unitText}>cm</Text>
          </View>
        </View>

        <Text style={styles.separator}>×</Text>

        <View style={styles.dimensionInput}>
          <Text style={styles.dimensionLabel}>Boy</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              value={l}
              onChangeText={(t) => handleChange('l', t)}
              keyboardType="numeric"
              placeholder="—"
              placeholderTextColor="#D1D5DB"
              maxLength={4}
            />
            <Text style={styles.unitText}>cm</Text>
          </View>
        </View>

        <Text style={styles.separator}>×</Text>

        <View style={styles.dimensionInput}>
          <Text style={styles.dimensionLabel}>Yükseklik</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              value={h}
              onChangeText={(t) => handleChange('h', t)}
              keyboardType="numeric"
              placeholder="—"
              placeholderTextColor="#D1D5DB"
              maxLength={4}
            />
            <Text style={styles.unitText}>cm</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={styles.skipButton}
        onPress={onSkip}
        activeOpacity={0.7}
      >
        <Text style={styles.skipButtonText}>Atla →</Text>
      </TouchableOpacity>

      {hasAnyDimension && (
        <TouchableOpacity
          style={styles.nextButton}
          onPress={onNext}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>Devam Et</Text>
        </TouchableOpacity>
      )}
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
    marginBottom: 32,
  },
  dimensionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    gap: 6,
  },
  dimensionInput: {
    flex: 1,
    alignItems: 'center',
  },
  dimensionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
    textAlign: 'center',
  },
  inputWrapper: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    width: '100%',
  },
  input: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    paddingVertical: 10,
    width: '100%',
  },
  unitText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
    marginBottom: 4,
  },
  separator: {
    fontSize: 24,
    color: '#9CA3AF',
    fontWeight: '300',
    marginTop: 20,
  },
  skipButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#868e96',
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
});
