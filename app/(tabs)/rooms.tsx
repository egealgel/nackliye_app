import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { VEHICLE_TYPES } from '@/constants/vehicleTypes';

const ROOM_CONFIG: Record<string, { icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string; bg: string }> = {
  minivan: { icon: 'van-utility', color: '#4CAF50', bg: '#E8F5E9' },
  kamyonet: { icon: 'truck-outline', color: '#2196F3', bg: '#E3F2FD' },
  kamyon: { icon: 'truck', color: '#FF6B35', bg: '#FFF0E8' },
  tir: { icon: 'truck-trailer', color: '#9C27B0', bg: '#F3E5F5' },
  damperli: { icon: 'dump-truck', color: '#F44336', bg: '#FFEBEE' },
  gondericiyim: { icon: 'package-variant', color: '#607D8B', bg: '#ECEFF1' },
};

export default function RoomsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Araç Tipi Odaları</Text>
      <Text style={styles.subtitle}>
        Araç tipine göre yükleri görüntüleyin
      </Text>

      <View style={styles.grid}>
        {VEHICLE_TYPES.map((vt) => {
          const cfg = ROOM_CONFIG[vt.value];
          return (
            <TouchableOpacity key={vt.value} style={styles.card} activeOpacity={0.7}>
              <View style={[styles.iconCircle, { backgroundColor: cfg?.bg ?? '#F5F5F5' }]}>
                <MaterialCommunityIcons
                  name={cfg?.icon ?? 'truck'}
                  size={32}
                  color={cfg?.color ?? '#999'}
                />
              </View>
              <Text style={styles.cardLabel}>{vt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  content: {
    padding: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
  },
});
