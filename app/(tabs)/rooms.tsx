import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { VehicleType, LoadWithDetails } from '@/types/load';
import { useRoomLoads, useRoomCounts, type RoomFilters } from '@/hooks/useRoomLoads';
import RoomTabs from '@/components/rooms/RoomTabs';
import RoomLoadCard from '@/components/rooms/RoomLoadCard';
import RoomFilterSheet from '@/components/rooms/RoomFilterSheet';
import BrandHeader from '@/components/BrandHeader';

const PRIMARY = '#2563EB';

const VALID_ROOMS: VehicleType[] = ['minivan', 'kamyonet', 'kamyon', 'tir', 'damperli', 'bos_arac'];

const DEFAULT_FILTERS: RoomFilters = {
  fromCities: [],
  fromCityDistricts: {},
  toCities: [],
  toCityDistricts: {},
  dateFilter: 'all',
  statusFilter: 'active',
};

function normalizeTr(str: string): string {
  return str
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .replace(/Ş/g, 'ş')
    .replace(/Ç/g, 'ç')
    .replace(/Ğ/g, 'ğ')
    .replace(/Ü/g, 'ü')
    .replace(/Ö/g, 'ö')
    .toLocaleLowerCase('tr-TR');
}

export default function RoomsScreen() {
  const { profile, session, refreshProfile } = useAuth();
  const [selectedRoom, setSelectedRoom] = useState<VehicleType>('minivan');
  const userPickedRoom = useRef(false);
  const lastAppliedVehicle = useRef<string | null>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchText, setSearchText] = useState('');

  const handleRoomSelect = useCallback((room: VehicleType) => {
    userPickedRoom.current = true;
    setSelectedRoom(room);
    // Clear search when switching away from Boş Araç (keeps behavior from before)
    if (room !== 'bos_arac') setSearchText('');
  }, []);

  const [filters, setFilters] = useState<RoomFilters>(DEFAULT_FILTERS);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  // For Boş Araç room, ignore all filters (only local text search applies),
  // but preserve the actual filter state to reuse when switching back.
  const effectiveFiltersForLoads: RoomFilters =
    selectedRoom === 'bos_arac'
      ? { ...DEFAULT_FILTERS, statusFilter: 'all' }
      : filters;

  const { loads, isLoading, refresh, removeLoad } = useRoomLoads(
    selectedRoom,
    effectiveFiltersForLoads,
  );
  const { counts, refresh: refreshCounts } = useRoomCounts(filters);

  const hasAnyFilter =
    filters.fromCities.length > 0 ||
    filters.toCities.length > 0 ||
    filters.dateFilter !== 'all' ||
    filters.statusFilter !== 'active';

  useEffect(() => {
    if (Platform.OS === 'android') {
      UIManager.setLayoutAnimationEnabledExperimental?.(true);
    }
  }, []);

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

  const isBosAracRoom = selectedRoom === 'bos_arac';
  const filteredLoads = searchText.trim()
    ? loads.filter((l) => {
        const q = normalizeTr(searchText.trim());
        if (!q) return true;
        if (isBosAracRoom) {
          return normalizeTr(l.description || '').includes(q);
        }
        const haystack = normalizeTr(
          [
            l.from_city,
            l.from_district,
            l.to_city,
            l.to_district,
            l.description,
          ]
            .filter(Boolean)
            .join(' '),
        );
        return haystack.includes(q);
      })
    : loads;

  const toggleSearch = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSearchVisible((v) => {
      const next = !v;
      if (!next) setSearchText('');
      return next;
    });
  }, []);

  const closeSearch = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSearchVisible(false);
    setSearchText('');
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <BrandHeader
        title="yüküstü"
        rightElement={
          <View style={styles.headerRightRow}>
            <TouchableOpacity
              onPress={toggleSearch}
              style={styles.headerIconBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="magnify" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            {!isBosAracRoom ? (
              <TouchableOpacity
                onPress={() => setFilterSheetVisible(true)}
                style={styles.headerIconBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="filter-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            ) : null}
          </View>
        }
      />

      {searchVisible && (
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Yük ara..."
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            onPress={closeSearch}
            style={styles.searchCloseBtn}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      )}

      <RoomTabs
        selected={selectedRoom}
        onSelect={handleRoomSelect}
        counts={counts}
      />

      {!isBosAracRoom && hasAnyFilter && (
        <TouchableOpacity
          style={styles.filtreAktifRow}
          onPress={() => setFilterSheetVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.filtreAktifText}>🔍 Filtre aktif</Text>
        </TouchableOpacity>
      )}

      <RoomFilterSheet
        visible={filterSheetVisible}
        appliedFilters={filters}
        onApply={setFilters}
        onClose={() => setFilterSheetVisible(false)}
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
          data={filteredLoads}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtreAktifRow: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    alignSelf: 'flex-start',
  },
  filtreAktifText: {
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 6,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    paddingVertical: 0,
    marginLeft: 8,
  },
  searchCloseBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
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
