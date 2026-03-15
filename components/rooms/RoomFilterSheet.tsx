import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';

const { height: WINDOW_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = WINDOW_HEIGHT * 0.75;
import Ionicons from '@expo/vector-icons/Ionicons';
import { TURKISH_CITIES } from '@/constants/turkishCities';
import { DISTRICTS } from '@/constants/districts';
import type {
  DateFilter,
  StatusFilter,
  RoomFilters,
} from '@/hooks/useRoomLoads';

const PRIMARY = '#2563EB';

const DEFAULT_FILTERS: RoomFilters = {
  fromCities: [],
  fromCityDistricts: {},
  toCities: [],
  toCityDistricts: {},
  dateFilter: 'all',
  statusFilter: 'active',
};

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

type SectionKey = 'nereden' | 'nereye' | 'tarih' | 'durum';

type Props = {
  visible: boolean;
  appliedFilters: RoomFilters;
  onApply: (f: RoomFilters) => void;
  onClose: () => void;
};

function neredenSummary(p: RoomFilters): string {
  if (p.fromCities.length === 0) return '';
  const parts = p.fromCities.slice(0, 3);
  const more = p.fromCities.length > 3 ? ` +${p.fromCities.length - 3}` : '';
  return parts.join(', ') + more;
}

function nereyeSummary(p: RoomFilters): string {
  if (p.toCities.length === 0) return '';
  const parts = p.toCities.slice(0, 3);
  const more = p.toCities.length > 3 ? ` +${p.toCities.length - 3}` : '';
  return parts.join(', ') + more;
}

export default function RoomFilterSheet({
  visible,
  appliedFilters,
  onApply,
  onClose,
}: Props) {
  const [pending, setPending] = useState<RoomFilters>({ ...DEFAULT_FILTERS });
  const [expandedSection, setExpandedSection] = useState<SectionKey | null>(null);
  const [citySearch, setCitySearch] = useState('');
  const [districtSearch, setDistrictSearch] = useState<Record<string, string>>({});
  const [neredenIlceExpanded, setNeredenIlceExpanded] = useState(false);
  const [neredenExpandedCity, setNeredenExpandedCity] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      const fromDistricts = appliedFilters.fromCityDistricts ?? {};
      const toDistricts = appliedFilters.toCityDistricts ?? {};
      setPending({
        fromCities: [...appliedFilters.fromCities],
        fromCityDistricts: Object.keys(fromDistricts).reduce<Record<string, string[]>>(
          (acc, c) => {
            acc[c] = [...(fromDistricts[c] || [])];
            return acc;
          },
          {},
        ),
        toCities: [...appliedFilters.toCities],
        toCityDistricts: Object.keys(toDistricts).reduce<Record<string, string[]>>(
          (acc, c) => {
            acc[c] = [...(toDistricts[c] || [])];
            return acc;
          },
          {},
        ),
        dateFilter: appliedFilters.dateFilter,
        statusFilter: appliedFilters.statusFilter,
      });
      setExpandedSection(null);
      setCitySearch('');
      setDistrictSearch({});
      setNeredenIlceExpanded(false);
      setNeredenExpandedCity(null);
    }
  }, [visible, appliedFilters]);

  const toggleSection = (key: SectionKey) => {
    setExpandedSection((prev) => (prev === key ? null : key));
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

  const toggleNeredenCity = (city: string) => {
    setPending((prev) => {
      const next = prev.fromCities.includes(city)
        ? prev.fromCities.filter((c) => c !== city)
        : [...prev.fromCities, city];
      const nextDistricts = { ...prev.fromCityDistricts };
      if (!prev.fromCities.includes(city)) nextDistricts[city] = [];
      else delete nextDistricts[city];
      return { ...prev, fromCities: next, fromCityDistricts: nextDistricts };
    });
  };

  const toggleNereyeCity = (city: string) => {
    setPending((prev) => ({
      ...prev,
      toCities: prev.toCities.includes(city)
        ? prev.toCities.filter((c) => c !== city)
        : [...prev.toCities, city],
    }));
  };

  const toggleNeredenDistrict = (city: string, district: string) => {
    setPending((prev) => {
      const list = prev.fromCityDistricts[city] || [];
      const next = list.includes(district)
        ? list.filter((d) => d !== district)
        : [...list, district];
      return { ...prev, fromCityDistricts: { ...prev.fromCityDistricts, [city]: next } };
    });
  };

  const handleClear = () => {
    setPending({ ...DEFAULT_FILTERS });
    onApply(DEFAULT_FILTERS);
    onClose();
  };

  const handleApply = () => {
    onApply(pending);
    onClose();
  };

  const dateLabel = DATE_OPTIONS.find((o) => o.value === pending.dateFilter)?.label ?? 'Tümü';
  const statusLabel =
    STATUS_OPTIONS.find((o) => o.value === pending.statusFilter)?.label ?? 'Aktif';

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          style={[styles.sheet, { height: SHEET_HEIGHT }]}
        >
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Filtreler</Text>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboard}
          >
            <ScrollView
              style={styles.scroll}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {/* Nereden */}
              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => toggleSection('nereden')}
                >
                  <View style={styles.sectionHeaderLeft}>
                    <Text style={styles.sectionLabel}>Nereden</Text>
                    {pending.fromCities.length > 0 && (
                      <Text style={styles.sectionSummary}>
                        {' · '}
                        {neredenSummary(pending)}
                      </Text>
                    )}
                  </View>
                  <Ionicons
                    name={expandedSection === 'nereden' ? 'chevron-up' : 'chevron-forward'}
                    size={20}
                    color="#6B7280"
                  />
                </TouchableOpacity>
                {expandedSection === 'nereden' && (
                  <View style={styles.sectionBody}>
                    {pending.fromCities.length > 0 && (
                      <View style={styles.tagsRow}>
                        {pending.fromCities.map((c) => (
                          <View key={c} style={styles.tag}>
                            <Text style={styles.tagText}>{c}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    <TextInput
                      style={styles.searchInput}
                      placeholder="İl ara..."
                      placeholderTextColor="#999"
                      value={citySearch}
                      onChangeText={setCitySearch}
                    />
                    <ScrollView style={styles.cityList} nestedScrollEnabled>
                      {filteredCities.map((item) => (
                        <TouchableOpacity
                          key={item}
                          style={[
                            styles.listItem,
                            pending.fromCities.includes(item) && styles.listItemSelected,
                          ]}
                          onPress={() => toggleNeredenCity(item)}
                        >
                          <Text
                            style={[
                              styles.listItemText,
                              pending.fromCities.includes(item) && styles.listItemSelectedText,
                            ]}
                          >
                            {item}
                          </Text>
                          {pending.fromCities.includes(item) && (
                            <Ionicons name="checkmark-circle" size={20} color={PRIMARY} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    {pending.fromCities.length > 0 && (
                      <>
                        <TouchableOpacity
                          style={styles.ilceSecHeader}
                          onPress={() => setNeredenIlceExpanded((p) => !p)}
                        >
                          <Text style={styles.ilceSecTitle}>İlçe Seç</Text>
                          <Ionicons
                            name={neredenIlceExpanded ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color="#6B7280"
                          />
                        </TouchableOpacity>
                        {neredenIlceExpanded &&
                          pending.fromCities.map((city) => {
                            const dists = DISTRICTS[city];
                            if (!dists || dists.length === 0) return null;
                            const isCityExpanded = neredenExpandedCity === city;
                            const selectedDists = pending.fromCityDistricts[city] || [];
                            return (
                              <View key={city} style={styles.cityBlock}>
                                <TouchableOpacity
                                  style={styles.cityBlockHeader}
                                  onPress={() =>
                                    setNeredenExpandedCity(isCityExpanded ? null : city)
                                  }
                                >
                                  <Text style={styles.cityBlockHeaderText}>
                                    {city}
                                    {selectedDists.length > 0 ? ` (${selectedDists.length})` : ''}
                                  </Text>
                                  <Ionicons
                                    name={isCityExpanded ? 'chevron-up' : 'chevron-down'}
                                    size={18}
                                    color="#666"
                                  />
                                </TouchableOpacity>
                                {isCityExpanded && (
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
                                    <ScrollView style={styles.districtScroll} nestedScrollEnabled>
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
                                              <Ionicons name="checkmark" size={18} color={PRIMARY} />
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
                      </>
                    )}
                  </View>
                )}
              </View>
              <View style={styles.divider} />

              {/* Nereye */}
              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => toggleSection('nereye')}
                >
                  <View style={styles.sectionHeaderLeft}>
                    <Text style={styles.sectionLabel}>Nereye</Text>
                    {pending.toCities.length > 0 && (
                      <Text style={styles.sectionSummary}>
                        {' · '}
                        {nereyeSummary(pending)}
                      </Text>
                    )}
                  </View>
                  <Ionicons
                    name={expandedSection === 'nereye' ? 'chevron-up' : 'chevron-forward'}
                    size={20}
                    color="#6B7280"
                  />
                </TouchableOpacity>
                {expandedSection === 'nereye' && (
                  <View style={styles.sectionBody}>
                    {pending.toCities.length > 0 && (
                      <View style={styles.tagsRow}>
                        {pending.toCities.map((c) => (
                          <View key={c} style={styles.tag}>
                            <Text style={styles.tagText}>{c}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    <TextInput
                      style={styles.searchInput}
                      placeholder="İl ara..."
                      placeholderTextColor="#999"
                      value={citySearch}
                      onChangeText={setCitySearch}
                    />
                    <ScrollView style={styles.cityList} nestedScrollEnabled>
                      {filteredCities.map((item) => (
                        <TouchableOpacity
                          key={item}
                          style={[
                            styles.listItem,
                            pending.toCities.includes(item) && styles.listItemSelected,
                          ]}
                          onPress={() => toggleNereyeCity(item)}
                        >
                          <Text
                            style={[
                              styles.listItemText,
                              pending.toCities.includes(item) && styles.listItemSelectedText,
                            ]}
                          >
                            {item}
                          </Text>
                          {pending.toCities.includes(item) && (
                            <Ionicons name="checkmark-circle" size={20} color={PRIMARY} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
              <View style={styles.divider} />

              {/* Tarih */}
              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => toggleSection('tarih')}
                >
                  <View style={styles.sectionHeaderLeft}>
                    <Text style={styles.sectionLabel}>Tarih</Text>
                    <Text style={styles.sectionSummary}>
                      {' · '}
                      {dateLabel}
                    </Text>
                  </View>
                  <Ionicons
                    name={expandedSection === 'tarih' ? 'chevron-up' : 'chevron-forward'}
                    size={20}
                    color="#6B7280"
                  />
                </TouchableOpacity>
                {expandedSection === 'tarih' && (
                  <View style={styles.sectionBody}>
                    {DATE_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[
                          styles.radioItem,
                          pending.dateFilter === opt.value && styles.radioItemSelected,
                        ]}
                        onPress={() => setPending((p) => ({ ...p, dateFilter: opt.value }))}
                      >
                        <Text
                          style={[
                            styles.radioLabel,
                            pending.dateFilter === opt.value && styles.radioLabelSelected,
                          ]}
                        >
                          {opt.label}
                        </Text>
                        {pending.dateFilter === opt.value && (
                          <Ionicons name="checkmark" size={20} color={PRIMARY} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              <View style={styles.divider} />

              {/* Durum */}
              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => toggleSection('durum')}
                >
                  <View style={styles.sectionHeaderLeft}>
                    <Text style={styles.sectionLabel}>Durum</Text>
                    <Text style={styles.sectionSummary}>
                      {' · '}
                      {statusLabel}
                    </Text>
                  </View>
                  <Ionicons
                    name={expandedSection === 'durum' ? 'chevron-up' : 'chevron-forward'}
                    size={20}
                    color="#6B7280"
                  />
                </TouchableOpacity>
                {expandedSection === 'durum' && (
                  <View style={styles.sectionBody}>
                    {STATUS_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[
                          styles.radioItem,
                          pending.statusFilter === opt.value && styles.radioItemSelected,
                        ]}
                        onPress={() => setPending((p) => ({ ...p, statusFilter: opt.value }))}
                      >
                        <Text
                          style={[
                            styles.radioLabel,
                            pending.statusFilter === opt.value && styles.radioLabelSelected,
                          ]}
                        >
                          {opt.label}
                        </Text>
                        {pending.statusFilter === opt.value && (
                          <Ionicons name="checkmark" size={20} color={PRIMARY} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.bottomSpacer} />
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity style={styles.clearBtn} onPress={handleClear} activeOpacity={0.8}>
                <Text style={styles.clearBtnText}>Filtreleri Temizle</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={handleApply} activeOpacity={0.8}>
                <Text style={styles.applyBtnText}>Uygula</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  keyboard: {
    flex: 1,
    minHeight: 0,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  section: {
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  sectionHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 0,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  sectionSummary: {
    fontSize: 14,
    fontWeight: '500',
    color: PRIMARY,
  },
  sectionBody: {
    paddingBottom: 16,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  tag: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY,
  },
  searchInput: {
    height: 42,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#1A1A1A',
    marginBottom: 8,
  },
  cityList: {
    maxHeight: 220,
    marginBottom: 8,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  listItemSelected: {
    backgroundColor: '#F0F7FF',
    borderRadius: 8,
    marginHorizontal: -4,
    paddingHorizontal: 8,
  },
  listItemText: {
    fontSize: 15,
    color: '#1A1A1A',
  },
  listItemSelectedText: {
    color: PRIMARY,
    fontWeight: '600',
  },
  ilceSecHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  ilceSecTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  cityBlock: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    marginBottom: 10,
    overflow: 'hidden',
  },
  cityBlockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
  },
  cityBlockHeaderText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  districtList: {
    padding: 12,
  },
  districtSearch: {
    height: 38,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1A1A1A',
    marginBottom: 8,
  },
  districtScroll: {
    maxHeight: 160,
  },
  districtItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  districtItemSelected: {
    backgroundColor: '#F0F7FF',
    borderRadius: 6,
  },
  districtItemText: {
    fontSize: 14,
    color: '#374151',
  },
  districtItemTextSelected: {
    color: PRIMARY,
    fontWeight: '600',
  },
  radioItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  radioItemSelected: {
    backgroundColor: '#F0F7FF',
    borderRadius: 8,
    marginHorizontal: -4,
    paddingHorizontal: 12,
  },
  radioLabel: {
    fontSize: 15,
    color: '#374151',
  },
  radioLabelSelected: {
    color: PRIMARY,
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    marginLeft: 20,
    marginRight: 20,
  },
  bottomSpacer: {
    height: 24,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  clearBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  clearBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  applyBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    alignItems: 'center',
  },
  applyBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
