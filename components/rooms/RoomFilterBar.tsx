import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  SafeAreaView,
  FlatList,
  TextInput,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { TURKISH_CITIES } from '@/constants/turkishCities';
import { DISTRICTS } from '@/constants/districts';
import type { DateFilter, StatusFilter, RoomFilters } from '@/hooks/useRoomLoads';

const PRIMARY = '#2563EB';

const DATE_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: 'today', label: 'Bugün' },
  { value: '3days', label: 'Son 3 Gün' },
  { value: 'week', label: 'Bu Hafta' },
  { value: 'all', label: 'Tümü' },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'active', label: 'Aktif' },
  { value: 'assigned', label: 'İş Verildi' },
  { value: 'all', label: 'Tümü' },
];

type Props = {
  filters: RoomFilters;
  onFiltersChange: (f: RoomFilters) => void;
};

export default function RoomFilterBar({ filters, onFiltersChange }: Props) {
  const [picker, setPicker] = useState<'nereden' | 'nereye' | 'tarih' | 'durum' | null>(null);
  const [neredenMode, setNeredenMode] = useState<'city' | 'district'>('city');
  const [neredenCity, setNeredenCity] = useState(filters.fromCity || '');
  const [neredenDistrict, setNeredenDistrict] = useState(filters.fromDistrict || '');
  const [citySearch, setCitySearch] = useState('');

  const hasAnyFilter =
    filters.fromCity ||
    filters.toCity ||
    filters.dateFilter !== 'all' ||
    filters.statusFilter !== 'active';

  const filteredCities = useMemo(() => {
    if (!citySearch) return [...TURKISH_CITIES];
    const q = citySearch.toLocaleLowerCase('tr-TR');
    return TURKISH_CITIES.filter((c) => c.toLocaleLowerCase('tr-TR').includes(q));
  }, [citySearch]);

  const filteredDistricts = useMemo(() => {
    if (!neredenCity) return [];
    const districts = DISTRICTS[neredenCity] || [];
    if (!citySearch) return districts;
    const q = citySearch.toLocaleLowerCase('tr-TR');
    return districts.filter((d) => d.toLocaleLowerCase('tr-TR').includes(q));
  }, [neredenCity, citySearch]);

  const openNereden = () => {
    setNeredenCity(filters.fromCity || '');
    setNeredenDistrict(filters.fromDistrict || '');
    setNeredenMode(filters.fromCity ? 'district' : 'city');
    setCitySearch('');
    setPicker('nereden');
  };

  const applyNereden = (city: string, district: string) => {
    onFiltersChange({
      ...filters,
      fromCity: city || null,
      fromDistrict: district || null,
    });
    setPicker(null);
  };

  const openNereye = () => {
    setCitySearch('');
    setPicker('nereye');
  };

  const applyNereye = (city: string) => {
    onFiltersChange({ ...filters, toCity: city || null });
    setPicker(null);
  };

  const clearFilters = () => {
    onFiltersChange({
      fromCity: null,
      fromDistrict: null,
      toCity: null,
      dateFilter: 'all',
      statusFilter: 'active',
    });
  };

  const neredenLabel = filters.fromCity
    ? filters.fromDistrict
      ? `${filters.fromCity}/${filters.fromDistrict}`
      : filters.fromCity
    : 'Nereden';
  const nereyeLabel = filters.toCity || 'Nereye';
  const tarihLabel = DATE_OPTIONS.find((o) => o.value === filters.dateFilter)?.label || 'Tarih';
  const durumLabel = STATUS_OPTIONS.find((o) => o.value === filters.statusFilter)?.label || 'Durum';

  const Chip = ({
    label,
    selected,
    onPress,
    onClear,
  }: {
    label: string;
    selected: boolean;
    onPress: () => void;
    onClear?: () => void;
  }) => (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>
        {label}
      </Text>
      {selected && onClear && (
        <TouchableOpacity
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={(e) => {
            e.stopPropagation();
            onClear();
          }}
          style={styles.chipClear}
        >
          <Ionicons name="close" size={14} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        <Chip
          label={neredenLabel}
          selected={!!filters.fromCity}
          onPress={openNereden}
          onClear={
            filters.fromCity
              ? () =>
                  onFiltersChange({
                    ...filters,
                    fromCity: null,
                    fromDistrict: null,
                  })
              : undefined
          }
        />
        <Chip
          label={nereyeLabel}
          selected={!!filters.toCity}
          onPress={openNereye}
          onClear={filters.toCity ? () => onFiltersChange({ ...filters, toCity: null }) : undefined}
        />
        <Chip
          label={tarihLabel}
          selected={filters.dateFilter !== 'all'}
          onPress={() => setPicker('tarih')}
          onClear={
            filters.dateFilter !== 'all'
              ? () => onFiltersChange({ ...filters, dateFilter: 'all' })
              : undefined
          }
        />
        <Chip
          label={durumLabel}
          selected={filters.statusFilter !== 'active'}
          onPress={() => setPicker('durum')}
          onClear={
            filters.statusFilter !== 'active'
              ? () => onFiltersChange({ ...filters, statusFilter: 'active' })
              : undefined
          }
        />
      </ScrollView>

      {hasAnyFilter && (
        <TouchableOpacity style={styles.clearBtn} onPress={clearFilters} activeOpacity={0.7}>
          <Ionicons name="close-circle-outline" size={16} color="#666" />
          <Text style={styles.clearBtnText}>Filtreleri Temizle</Text>
        </TouchableOpacity>
      )}

      {/* Nereden picker: city + optional district */}
      <Modal visible={picker === 'nereden'} animationType="slide">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nereden</Text>
            <TouchableOpacity onPress={() => setPicker(null)}>
              <Text style={styles.modalClose}>Kapat</Text>
            </TouchableOpacity>
          </View>
          {neredenMode === 'city' ? (
            <>
              <TextInput
                style={styles.searchInput}
                placeholder="İl ara..."
                placeholderTextColor="#999"
                value={citySearch}
                onChangeText={setCitySearch}
                autoFocus
              />
              <FlatList
                data={filteredCities}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.listItem}
                    onPress={() => {
                      setNeredenCity(item);
                      setCitySearch('');
                      const districts = DISTRICTS[item];
                      if (districts && districts.length > 0) {
                        setNeredenMode('district');
                      } else {
                        applyNereden(item, '');
                      }
                    }}
                  >
                    <Text style={styles.listItemText}>{item}</Text>
                    <Ionicons name="chevron-forward" size={18} color="#CCC" />
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.backToCity}
                onPress={() => {
                  setNeredenMode('city');
                  setCitySearch('');
                }}
              >
                <Ionicons name="chevron-back" size={18} color={PRIMARY} />
                <Text style={styles.backToCityText}>{neredenCity}</Text>
                <Text style={styles.changeText}>Değiştir</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.skipDistrict}
                onPress={() => applyNereden(neredenCity, '')}
              >
                <Text style={styles.skipDistrictText}>Tüm il (ilçe seçme)</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.searchInput}
                placeholder="İlçe ara..."
                placeholderTextColor="#999"
                value={citySearch}
                onChangeText={setCitySearch}
              />
              <FlatList
                data={filteredDistricts}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.listItem}
                    onPress={() => applyNereden(neredenCity, item)}
                  >
                    <Text style={styles.listItemText}>{item}</Text>
                    <Ionicons name="checkmark" size={20} color={PRIMARY} />
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            </>
          )}
        </SafeAreaView>
      </Modal>

      {/* Nereye picker: city only */}
      <Modal visible={picker === 'nereye'} animationType="slide">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nereye</Text>
            <TouchableOpacity onPress={() => setPicker(null)}>
              <Text style={styles.modalClose}>Kapat</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="İl ara..."
            placeholderTextColor="#999"
            value={citySearch}
            onChangeText={setCitySearch}
            autoFocus
          />
          <FlatList
            data={filteredCities}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.listItem, item === filters.toCity && styles.listItemSelected]}
                onPress={() => applyNereye(item)}
              >
                <Text
                  style={[styles.listItemText, item === filters.toCity && styles.listItemSelectedText]}
                >
                  {item}
                </Text>
                {item === filters.toCity && <Ionicons name="checkmark" size={22} color={PRIMARY} />}
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </SafeAreaView>
      </Modal>

      {/* Tarih picker */}
      <Modal visible={picker === 'tarih'} animationType="slide">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Tarih</Text>
            <TouchableOpacity onPress={() => setPicker(null)}>
              <Text style={styles.modalClose}>Kapat</Text>
            </TouchableOpacity>
          </View>
          {DATE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.optionItem, opt.value === filters.dateFilter && styles.optionItemSelected]}
              onPress={() => {
                onFiltersChange({ ...filters, dateFilter: opt.value });
                setPicker(null);
              }}
            >
              <Text
                style={[
                  styles.optionItemText,
                  opt.value === filters.dateFilter && styles.optionItemTextSelected,
                ]}
              >
                {opt.label}
              </Text>
              {opt.value === filters.dateFilter && (
                <Ionicons name="checkmark" size={22} color={PRIMARY} />
              )}
            </TouchableOpacity>
          ))}
        </SafeAreaView>
      </Modal>

      {/* Durum picker */}
      <Modal visible={picker === 'durum'} animationType="slide">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Durum</Text>
            <TouchableOpacity onPress={() => setPicker(null)}>
              <Text style={styles.modalClose}>Kapat</Text>
            </TouchableOpacity>
          </View>
          {STATUS_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.optionItem, opt.value === filters.statusFilter && styles.optionItemSelected]}
              onPress={() => {
                onFiltersChange({ ...filters, statusFilter: opt.value });
                setPicker(null);
              }}
            >
              <Text
                style={[
                  styles.optionItemText,
                  opt.value === filters.statusFilter && styles.optionItemTextSelected,
                ]}
              >
                {opt.label}
              </Text>
              {opt.value === filters.statusFilter && (
                <Ionicons name="checkmark" size={22} color={PRIMARY} />
              )}
            </TouchableOpacity>
          ))}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    gap: 6,
  },
  chipSelected: {
    backgroundColor: PRIMARY,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  chipClear: {
    padding: 2,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
    alignSelf: 'flex-start',
  },
  clearBtnText: {
    fontSize: 14,
    color: '#666',
  },
  modal: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  modalClose: {
    fontSize: 16,
    color: PRIMARY,
    fontWeight: '600',
  },
  searchInput: {
    height: 48,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1A1A1A',
    margin: 16,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  listItemSelected: {
    backgroundColor: '#FFF5F0',
  },
  listItemText: {
    fontSize: 18,
    color: '#1A1A1A',
  },
  listItemSelectedText: {
    color: PRIMARY,
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 20,
  },
  backToCity: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 6,
  },
  backToCityText: {
    fontSize: 16,
    fontWeight: '600',
    color: PRIMARY,
  },
  changeText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  skipDistrict: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 8,
  },
  skipDistrictText: {
    fontSize: 16,
    color: PRIMARY,
    fontWeight: '600',
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  optionItemSelected: {
    backgroundColor: '#FFF5F0',
  },
  optionItemText: {
    fontSize: 18,
    color: '#1A1A1A',
  },
  optionItemTextSelected: {
    color: PRIMARY,
    fontWeight: '600',
  },
});
