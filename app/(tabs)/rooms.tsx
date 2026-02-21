import React, { useState, useCallback } from 'react';
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
import { useRoomLoads, useRoomCounts } from '@/hooks/useRoomLoads';
import RoomTabs from '@/components/rooms/RoomTabs';
import RoomLoadCard from '@/components/rooms/RoomLoadCard';

const PRIMARY = '#FF6B35';

export default function RoomsScreen() {
  const { session } = useAuth();
  const [selectedRoom, setSelectedRoom] = useState<VehicleType>('kamyonet');
  const { loads, isLoading, refresh } = useRoomLoads(selectedRoom);
  const { counts, refresh: refreshCounts } = useRoomCounts();

  useFocusEffect(
    useCallback(() => {
      refreshCounts();
    }, [refreshCounts]),
  );
  const [refreshing, setRefreshing] = useState(false);

  const currentUserId = session?.user?.id || '';

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const renderItem = useCallback(
    ({ item }: { item: LoadWithDetails }) => (
      <RoomLoadCard load={item} currentUserId={currentUserId} />
    ),
    [currentUserId],
  );

  const keyExtractor = useCallback((item: LoadWithDetails) => item.id, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Odalar</Text>
      </View>

      <RoomTabs
        selected={selectedRoom}
        onSelect={setSelectedRoom}
        counts={counts}
      />

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
  titleRow: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
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
