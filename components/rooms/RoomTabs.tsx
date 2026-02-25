import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { VehicleType, ROOM_LIST } from '@/types/load';

type Props = {
  selected: VehicleType;
  onSelect: (type: VehicleType) => void;
  counts: Record<string, number>;
};

const PRIMARY = '#2563EB';

const ROW1 = ['minivan', 'kamyonet', 'kamyon'] as VehicleType[];
const ROW2 = ['tir', 'damperli', 'bos_arac'] as VehicleType[];

export default function RoomTabs({ selected, onSelect, counts }: Props) {
  const renderButton = (roomType: VehicleType) => {
    const room = ROOM_LIST.find((r) => r.type === roomType);
    if (!room) return null;

    const isActive = selected === room.type;
    const count = counts[room.type] || 0;

    return (
      <TouchableOpacity
        key={room.type}
        style={[styles.button, isActive && styles.buttonActive]}
        onPress={() => onSelect(room.type)}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons
          name={room.icon as any}
          size={26}
          color={isActive ? '#FFFFFF' : '#374151'}
        />
        <Text style={[styles.buttonName, isActive && styles.buttonTextActive]}>
          {room.label}
        </Text>
        <Text style={[styles.buttonRange, isActive && styles.buttonTextActive]}>
          {room.range}
        </Text>
        {count > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{count}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {ROW1.map(renderButton)}
      </View>
      <View style={styles.row}>
        {ROW2.map(renderButton)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    height: 70,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    position: 'relative',
  },
  buttonActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  buttonName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 4,
  },
  buttonRange: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  buttonTextActive: {
    color: '#FFFFFF',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: PRIMARY,
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
