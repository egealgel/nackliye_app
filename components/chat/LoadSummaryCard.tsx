import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import RouteDisplay from '@/components/RouteDisplay';
import { formatWeight } from '@/types/load';

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktif',
  has_offers: 'Teklif Var',
  assigned: 'Atandı',
  in_transit: 'Yolda',
  delivered: 'Teslim Edildi',
  cancelled: 'İptal',
};

type Props = {
  fromCity: string;
  fromDistrict: string;
  toCity: string;
  toDistrict: string;
  weightKg: number;
  status: string;
  description?: string | null;
  vehicleType?: string | null;
};

export default function LoadSummaryCard({
  fromCity,
  fromDistrict,
  toCity,
  toDistrict,
  weightKg,
  status,
  description,
  vehicleType,
}: Props) {
  const isBosArac =
    vehicleType === 'bos_arac' ||
    !fromCity;

  const fromD = fromDistrict || fromCity || '';
  const toD = toDistrict || toCity || '';
  return (
    <View style={styles.card}>
      {isBosArac ? (
        <>
          {description ? (
            <Text style={styles.description} numberOfLines={1}>
              {description}
            </Text>
          ) : null}
          <View style={styles.meta}>
            <View
              style={[
                styles.statusBadge,
                status === 'active' && styles.statusBadgeActive,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  status === 'active' && styles.statusTextActive,
                ]}
              >
                {STATUS_LABELS[status] || status}
              </Text>
            </View>
          </View>
        </>
      ) : (
        <>
          <RouteDisplay
            fromCity={fromCity}
            fromDistrict={fromD}
            toCity={toCity}
            toDistrict={toD}
          />
          <View style={styles.meta}>
            <Text style={styles.weight}>{formatWeight(weightKg)}</Text>
            <View
              style={[
                styles.statusBadge,
                status === 'active' && styles.statusBadgeActive,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  status === 'active' && styles.statusTextActive,
                ]}
              >
                {STATUS_LABELS[status] || status}
              </Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  description: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  weight: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  statusBadge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeActive: {
    backgroundColor: '#E6F9E6',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  statusTextActive: {
    color: '#22C55E',
  },
});
