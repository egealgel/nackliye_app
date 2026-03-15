import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  SafeAreaView,
  FlatList,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
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
  const [citySearch, setCitySearch] = useState('');
  const [districtSearch, setDistrictSearch] = useState<Record<string, string>>({});

  // Picker local state (applied on Tamam)
  const [neredenCities, setNeredenCities] = useState<string[]>([]);
  const [neredenDistricts, setNeredenDistricts] = useState<Record<string, string[]>>({});
  const [nereyeCities, setNereyeCities] = useState<string[]>([]);
  const [neredenExpandedCity, setNeredenExpandedCity] = useState<string | null>(null);

  const hasAnyFilter =
    filters.fromCities.length > 0 ||
    filters.toCities.length > 0 ||
    filters.dateFilter !== 'all' ||
    filters.statusFilter !== 'active';

  const clearFilters = () => {
    onFiltersChange({
      fromCities: [],
      fromCityDistricts: {},
      toCities: [],
      toCityDistricts: {},
      dateFilter: 'all',
      statusFilter: 'active',
    });
  };

  const filteredCities = useMemo(() => {
    if (!citySearch) return [...TURKISH_CITIES];
    const q = citySearch.toLocaleLowerCase('tr-TR');
    return TURKISH_CITIES.filter((c) => c.toLocaleLowerCase('tr-TR').includes(q));
  }, [citySearch]);

  const getFilteredDistricts = (city: string) => {
    const districts = DISTRICTS[city] || [];
    const search = districtSearch[city] || '';
    if (!search) return districts;
    const q = search.toLocaleLowerCase('tr-TR');
    return districts.filter((d) => d.toLocaleLowerCase('tr-TR').includes(q));
  };

  const openNereden = () => {
    setNeredenCities([...filters.fromCities]);
    setNeredenDistricts(
      filters.fromCities.reduce<Record<string, string[]>>((acc, c) => {
        acc[c] = filters.fromCityDistricts[c] ? [...filters.fromCityDistricts[c]] : [];
        return acc;
      }, {})
    );
    setCitySearch('');
    setDistrictSearch({});
    setNeredenExpandedCity(null);
    setPicker('nereden');
  };

  const openNereye = () => {
    setNereyeCities([...filters.toCities]);
    setCitySearch('');
    setPicker('nereye');
  };

  const toggleNeredenCity = (city: string) => {
    setNeredenCities((prev) =>
      prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city]
    );
    if (!neredenCities.includes(city)) {
      setNeredenDistricts((prev) => ({ ...prev, [city]: [] }));
    } else {
      setNeredenDistricts((prev) => {
        const next = { ...prev };
        delete next[city];
        return next;
      });
    }
  };

  const toggleNereyeCity = (city: string) => {
    setNereyeCities((prev) =>
      prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city]
    );
  };

  const toggleNeredenDistrict = (city: string, district: string) => {
    setNeredenDistricts((prev) => {
      const list = prev[city] || [];
      const next = [...list];
      const i = next.indexOf(district);
      if (i >= 0) next.splice(i, 1);
      else next.push(district);
      return { ...prev, [city]: next };
    });
  };

  const clearNeredenPicker = () => {
    setNeredenCities([]);
    setNeredenDistricts({});
    setDistrictSearch({});
  };

  const clearNereyePicker = () => {
    setNereyeCities([]);
  };

  const applyNereden = () => {
    onFiltersChange({
      ...filters,
      fromCities: [...neredenCities],
      fromCityDistricts: { ...neredenDistricts },
      toCityDistricts: filters.toCityDistricts ?? {},
    });
    setPicker(null);
  };

  const applyNereye = () => {
    onFiltersChange({
      ...filters,
      toCities: [...nereyeCities],
      toCityDistricts: filters.toCityDistricts ?? {},
    });
    setPicker(null);
  };


  const Chip = ({
    label,
    selected,
    onPress,
  }: {
    label: string;
    selected: boolean;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        style={[styles.chipText, selected && styles.chipTextSelected]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.chipsRow}>
        <Chip
          label="Nereden"
          selected={filters.fromCities.length > 0}
          onPress={openNereden}
        />
        <Chip
          label="Nereye"
          selected={filters.toCities.length > 0}
          onPress={openNereye}
        />
        <Chip
          label="Tarih"
          selected={filters.dateFilter !== 'all'}
          onPress={() => setPicker('tarih')}
        />
        <Chip
          label="Durum"
          selected={filters.statusFilter !== 'active'}
          onPress={() => setPicker('durum')}
        />
      </View>

      {hasAnyFilter && (
        <TouchableOpacity
          style={styles.clearFiltersBtn}
          onPress={clearFilters}
          activeOpacity={0.7}
        >
          <Text style={styles.clearFiltersText}>Filtreleri Temizle</Text>
        </TouchableOpacity>
      )}

      {/* Nereden picker: multi-select cities + optional districts */}
      <Modal visible={picker === 'nereden'} animationType="slide">
        <SafeAreaView style={styles.modal}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKeyboard}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nereden</Text>
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
                  style={[styles.listItem, neredenCities.includes(item) && styles.listItemSelected]}
                  onPress={() => toggleNeredenCity(item)}
                >
                  <Text
                    style={[
                      styles.listItemText,
                      neredenCities.includes(item) && styles.listItemSelectedText,
                    ]}
                  >
                    {item}
                  </Text>
                  {neredenCities.includes(item) && (
                    <Ionicons name="checkmark-circle" size={24} color={PRIMARY} />
                  )}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListFooterComponent={
                neredenCities.length > 0 ? (
                  <View style={styles.districtsSection}>
                    <Text style={styles.districtsSectionTitle}>İlçe Seç (Opsiyonel)</Text>
                    {neredenCities.map((city) => {
                      const dists = DISTRICTS[city];
                      if (!dists || dists.length === 0) return null;
                      const isExpanded = neredenExpandedCity === city;
                      const selectedDists = neredenDistricts[city] || [];
                      return (
                        <View key={city} style={styles.cityDistrictBlock}>
                          <TouchableOpacity
                            style={styles.cityDistrictHeader}
                            onPress={() =>
                              setNeredenExpandedCity(isExpanded ? null : city)
                            }
                          >
                            <Text style={styles.cityDistrictHeaderText}>
                              {city}
                              {selectedDists.length > 0 && ` (${selectedDists.length})`}
                            </Text>
                            <Ionicons
                              name={isExpanded ? 'chevron-up' : 'chevron-down'}
                              size={20}
                              color="#666"
                            />
                          </TouchableOpacity>
                          {isExpanded && (
                            <View style={styles.districtList}>
                              <TextInput
                                style={styles.districtSearch}
                                placeholder={`${city} ilçe ara...`}
                                placeholderTextColor="#999"
                                value={districtSearch[city] || ''}
                                onChangeText={(t) =>
                                  setDistrictSearch((prev) => ({ ...prev, [city]: t }))
                                }
                              />
                              <ScrollView
                                style={styles.districtScroll}
                                nestedScrollEnabled
                                showsVerticalScrollIndicator
                              >
                                {getFilteredDistricts(city).map((d) => {
                                const checked = selectedDists.includes(d);
                                return (
                                  <TouchableOpacity
                                    key={d}
                                    style={[
                                      styles.districtItem,
                                      checked && styles.districtItemSelected,
                                    ]}
                                    onPress={() => toggleNeredenDistrict(city, d)}
                                  >
                                    <Text
                                      style={[
                                        styles.districtItemText,
                                        checked && styles.districtItemTextSelected,
                                      ]}
                                    >
                                      {d}
                                    </Text>
                                    {checked && (
                                      <Ionicons name="checkmark" size={20} color={PRIMARY} />
                                    )}
                                  </TouchableOpacity>
                                );
                              })}
                              </ScrollView>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                ) : null
              }
            />
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.temizleBtn}
                onPress={clearNeredenPicker}
                disabled={neredenCities.length === 0}
              >
                <Text
                  style={[
                    styles.temizleBtnText,
                    neredenCities.length === 0 && styles.temizleBtnTextDisabled,
                  ]}
                >
                  Tümünü Temizle
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tamamBtn} onPress={applyNereden}>
                <Text style={styles.tamamBtnText}>Tamam</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Nereye picker: multi-select cities only */}
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
                style={[styles.listItem, nereyeCities.includes(item) && styles.listItemSelected]}
                onPress={() => toggleNereyeCity(item)}
              >
                <Text
                  style={[
                    styles.listItemText,
                    nereyeCities.includes(item) && styles.listItemSelectedText,
                  ]}
                >
                  {item}
                </Text>
                {nereyeCities.includes(item) && (
                  <Ionicons name="checkmark-circle" size={24} color={PRIMARY} />
                )}
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.temizleBtn}
              onPress={clearNereyePicker}
              disabled={nereyeCities.length === 0}
            >
              <Text
                style={[
                  styles.temizleBtnText,
                  nereyeCities.length === 0 && styles.temizleBtnTextDisabled,
                ]}
              >
                Tümünü Temizle
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tamamBtn} onPress={applyNereye}>
              <Text style={styles.tamamBtnText}>Tamam</Text>
            </TouchableOpacity>
          </View>
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
    gap: 6,
    alignItems: 'center',
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    minWidth: 0,
    overflow: 'hidden',
  },
  chipSelected: {
    backgroundColor: '#2563EB',
  },
  chipText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  clearFiltersBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  clearFiltersText: {
    fontSize: 13,
    color: '#6B7280',
  },
  modal: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalKeyboard: {
    flex: 1,
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
    backgroundColor: '#F0F7FF',
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
  districtsSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  districtsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  cityDistrictBlock: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cityDistrictHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#F9FAFB',
  },
  cityDistrictHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  districtList: {
    padding: 12,
  },
  districtScroll: {
    maxHeight: 200,
  },
  districtSearch: {
    height: 40,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1A1A1A',
    marginBottom: 10,
  },
  districtItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  districtItemSelected: {
    backgroundColor: '#F0F7FF',
    borderRadius: 8,
  },
  districtItemText: {
    fontSize: 15,
    color: '#374151',
  },
  districtItemTextSelected: {
    color: PRIMARY,
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  temizleBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  temizleBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  temizleBtnTextDisabled: {
    color: '#D1D5DB',
  },
  tamamBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    alignItems: 'center',
  },
  tamamBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
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
    backgroundColor: '#F0F7FF',
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
