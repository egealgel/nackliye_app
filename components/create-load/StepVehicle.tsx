import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  VehicleType,
  VEHICLE_LABELS,
  VEHICLE_ICONS,
  suggestVehicleType,
  isVehicleCompatible,
  formatWeight,
} from '@/types/load';

const PRIMARY = '#FF6B35';

const VEHICLE_ORDER: VehicleType[] = [
  'minivan',
  'kamyonet',
  'kamyon',
  'tir',
  'damperli',
];

type Props = {
  vehicleType: VehicleType;
  weight: number;
  onVehicleSelect: (type: VehicleType) => void;
  onNext: () => void;
};

export default function StepVehicle({
  vehicleType,
  weight,
  onVehicleSelect,
  onNext,
}: Props) {
  const suggested = suggestVehicleType(weight);
  const compatible = isVehicleCompatible(vehicleType, weight);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Araç türü seç</Text>
      <Text style={styles.subtitle}>
        {formatWeight(weight)} yük için araç seçin
      </Text>

      <View style={styles.grid}>
        {VEHICLE_ORDER.map((type) => {
          const isSelected = vehicleType === type;
          const isSuggested = suggested === type;

          return (
            <TouchableOpacity
              key={type}
              style={[
                styles.card,
                isSelected && styles.cardSelected,
                isSuggested && !isSelected && styles.cardSuggested,
              ]}
              onPress={() => onVehicleSelect(type)}
              activeOpacity={0.7}
            >
              {isSuggested && (
                <View style={styles.suggestedBadge}>
                  <Text style={styles.suggestedText}>Önerilen</Text>
                </View>
              )}
              <MaterialCommunityIcons
                name={VEHICLE_ICONS[type] as any}
                size={40}
                color={isSelected ? '#FFFFFF' : '#374151'}
              />
              <Text
                style={[
                  styles.cardLabel,
                  isSelected && styles.cardLabelSelected,
                ]}
              >
                {VEHICLE_LABELS[type]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {!compatible && (
        <View style={styles.warningBox}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={22}
            color="#F59E0B"
          />
          <Text style={styles.warningText}>
            {formatWeight(weight)} yük için{' '}
            <Text style={styles.warningBold}>
              {VEHICLE_LABELS[vehicleType]}
            </Text>{' '}
            kapasitesi yetersiz olabilir.{' '}
            <Text style={styles.warningBold}>
              {VEHICLE_LABELS[suggested]}
            </Text>{' '}
            öneriyoruz.
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.nextButton}
        onPress={onNext}
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  card: {
    width: '47%',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    position: 'relative',
  },
  cardSelected: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  cardSuggested: {
    borderColor: PRIMARY,
    borderStyle: 'dashed',
  },
  suggestedBadge: {
    position: 'absolute',
    top: -10,
    backgroundColor: PRIMARY,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  suggestedText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 10,
  },
  cardLabelSelected: {
    color: '#FFFFFF',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    gap: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
  warningBold: {
    fontWeight: '700',
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
