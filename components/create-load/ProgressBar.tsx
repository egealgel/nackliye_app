import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const PRIMARY = '#2563EB';

type Props = {
  currentStep: number;
  totalSteps: number;
};

export default function ProgressBar({ currentStep, totalSteps }: Props) {
  const progress = currentStep / totalSteps;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>
          Adım {currentStep}/{totalSteps}
        </Text>
        <Text style={styles.percent}>{Math.round(progress * 100)}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  percent: {
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY,
  },
  track: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: PRIMARY,
    borderRadius: 3,
  },
});
