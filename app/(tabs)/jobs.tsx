import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/lib/auth';
import { useMyLoads } from '@/hooks/useRoomLoads';
import { LoadWithDetails } from '@/types/load';
import RoomLoadCard from '@/components/rooms/RoomLoadCard';

const PRIMARY = '#FF6B35';

export default function JobsScreen() {
  const { session } = useAuth();
  const currentUserId = session?.user?.id ?? '';
  const { loads, isLoading, refresh } = useMyLoads(currentUserId);
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const renderItem = useCallback(
    ({ item }: { item: LoadWithDetails }) => (
      <RoomLoadCard load={item} currentUserId={currentUserId} />
    ),
    [currentUserId]
  );

  const keyExtractor = useCallback((item: LoadWithDetails) => item.id, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>İşlerim</Text>
        <Text style={styles.subtitle}>
          Paylaştığınız yükler ve size atanan işler
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : loads.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="briefcase-outline" size={56} color="#D1D5DB" />
          <Text style={styles.emptyText}>Henüz işiniz yok</Text>
          <Text style={styles.emptySubtitle}>
            Odalar sekmesinden yük paylaşın veya başkalarının yüklerine teklif verin.
          </Text>
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
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  list: {
    paddingTop: 12,
    paddingBottom: 20,
  },
});
