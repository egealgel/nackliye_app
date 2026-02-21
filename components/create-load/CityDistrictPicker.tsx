import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { TURKISH_CITIES } from '@/constants/turkishCities';
import { DISTRICTS } from '@/constants/districts';

const PRIMARY = '#FF6B35';

type Props = {
  title: string;
  selectedCity: string;
  selectedDistrict: string;
  onSelect: (city: string, district: string) => void;
};

export default function CityDistrictPicker({
  title,
  selectedCity,
  selectedDistrict,
  onSelect,
}: Props) {
  const [mode, setMode] = useState<'city' | 'district'>(
    selectedCity ? 'district' : 'city',
  );
  const [city, setCity] = useState(selectedCity);
  const [search, setSearch] = useState('');

  const filteredCities = useMemo(() => {
    if (!search) return [...TURKISH_CITIES];
    const q = search.toLocaleLowerCase('tr-TR');
    return TURKISH_CITIES.filter((c) =>
      c.toLocaleLowerCase('tr-TR').includes(q),
    );
  }, [search]);

  const filteredDistricts = useMemo(() => {
    if (!city) return [];
    const districts = DISTRICTS[city] || [];
    if (!search) return districts;
    const q = search.toLocaleLowerCase('tr-TR');
    return districts.filter((d) => d.toLocaleLowerCase('tr-TR').includes(q));
  }, [city, search]);

  const handleCitySelect = (selected: string) => {
    setCity(selected);
    setSearch('');
    setMode('district');
  };

  const handleDistrictSelect = (district: string) => {
    onSelect(city, district);
  };

  const handleBackToCity = () => {
    setCity('');
    setSearch('');
    setMode('city');
  };

  if (mode === 'city') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>İl seçin</Text>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="İl ara..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="words"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
        <FlatList
          data={filteredCities}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.listItem}
              onPress={() => handleCitySelect(item)}
              activeOpacity={0.6}
            >
              <Text style={styles.listItemText}>{item}</Text>
              <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
            </TouchableOpacity>
          )}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <TouchableOpacity style={styles.cityBadge} onPress={handleBackToCity}>
        <Ionicons name="chevron-back" size={14} color={PRIMARY} />
        <Text style={styles.cityBadgeText}>{city}</Text>
        <Text style={styles.changeText}>Değiştir</Text>
      </TouchableOpacity>
      <Text style={styles.subtitle}>İlçe seçin</Text>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="İlçe ara..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="words"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={filteredDistricts}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.listItem,
              item === selectedDistrict && styles.listItemSelected,
            ]}
            onPress={() => handleDistrictSelect(item)}
            activeOpacity={0.6}
          >
            <Text
              style={[
                styles.listItemText,
                item === selectedDistrict && styles.listItemTextSelected,
              ]}
            >
              {item}
            </Text>
            {item === selectedDistrict ? (
              <Ionicons name="checkmark" size={20} color={PRIMARY} />
            ) : (
              <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
            )}
          </TouchableOpacity>
        )}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1F2937',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    minHeight: 56,
  },
  listItemSelected: {
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    borderBottomColor: 'transparent',
    marginVertical: 2,
  },
  listItemText: {
    fontSize: 18,
    color: '#1F2937',
  },
  listItemTextSelected: {
    color: PRIMARY,
    fontWeight: '600',
  },
  cityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
    gap: 4,
  },
  cityBadgeText: {
    fontSize: 15,
    fontWeight: '600',
    color: PRIMARY,
  },
  changeText: {
    fontSize: 13,
    color: '#9CA3AF',
    marginLeft: 4,
  },
});
