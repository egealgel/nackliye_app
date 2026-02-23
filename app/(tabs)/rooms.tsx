import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/lib/auth';
import { VehicleType, LoadWithDetails } from '@/types/load';
import { useRoomLoads, useRoomCounts, type RoomFilters } from '@/hooks/useRoomLoads';
import RoomTabs from '@/components/rooms/RoomTabs';
import RoomFilterBar from '@/components/rooms/RoomFilterBar';
import RoomLoadCard from '@/components/rooms/RoomLoadCard';

const PRIMARY = '#2563EB';

const VALID_ROOMS: VehicleType[] = ['minivan', 'kamyonet', 'kamyon', 'tir', 'damperli'];

const DEFAULT_FILTERS: RoomFilters = {
  fromCities: [],
  fromCityDistricts: {},
  toCities: [],
  dateFilter: 'all',
  statusFilter: 'active',
};

export default function RoomsScreen() {
  const { profile, session, refreshProfile } = useAuth();
  const [selectedRoom, setSelectedRoom] = useState<VehicleType>('minivan');
  const userPickedRoom = useRef(false);
  const lastAppliedVehicle = useRef<string | null>(null);

  const handleRoomSelect = useCallback((room: VehicleType) => {
    userPickedRoom.current = true;
    setSelectedRoom(room);
  }, []);

  const [filters, setFilters] = useState<RoomFilters>(DEFAULT_FILTERS);
  const { loads, isLoading, refresh, removeLoad } = useRoomLoads(selectedRoom, filters);
  const { counts, refresh: refreshCounts } = useRoomCounts();

  useFocusEffect(
    useCallback(() => {
      refreshCounts();
      refreshProfile().then(() => {});
    }, [refreshCounts, refreshProfile]),
  );

  useEffect(() => {
    const vt = profile?.vehicle_type;
    if (!vt) return;
    if (vt === lastAppliedVehicle.current) return;
    const mapped = vt as VehicleType;
    if (VALID_ROOMS.includes(mapped)) {
      setSelectedRoom(mapped);
      userPickedRoom.current = false;
    }
    lastAppliedVehicle.current = vt;
  }, [profile?.vehicle_type]);
  const [refreshing, setRefreshing] = useState(false);

  const currentUserId = session?.user?.id || '';

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const renderItem = useCallback(
    ({ item }: { item: LoadWithDetails }) => (
      <RoomLoadCard load={item} currentUserId={currentUserId} onDelete={removeLoad} />
    ),
    [currentUserId, removeLoad],
  );

  const keyExtractor = useCallback((item: LoadWithDetails) => item.id, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.greeting}>
          Merhaba, {profile?.name ?? 'Kullanıcı'}!
        </Text>
        <Text style={styles.title}>Odalar</Text>
      </View>

      <RoomTabs
        selected={selectedRoom}
        onSelect={handleRoomSelect}
        counts={counts}
      />

      <RoomFilterBar filters={filters} onFiltersChange={setFilters} />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : loads.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="file-tray-outline" size={56} color="#D1D5DB" />
          <Text style={styles.emptyText}>Bu odada henüz yük yok</Text>
        </View>
      ) : (
        <FlatList
          data={loads}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={PRIMARY}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  greeting: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  list: {
    paddingTop: 4,
    paddingBottom: 20,
  },
});
