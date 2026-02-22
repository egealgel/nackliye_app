import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/lib/auth';
import { TURKISH_CITIES } from '@/constants/turkishCities';
import { VEHICLE_TYPES } from '@/constants/vehicleTypes';

export default function CompleteProfileScreen() {
  const { session, refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [citySearch, setCitySearch] = useState('');

  const filteredCities = TURKISH_CITIES.filter((c) =>
    c.toLowerCase().includes(citySearch.toLowerCase())
  );

  const vehicleLabel =
    VEHICLE_TYPES.find((v) => v.value === vehicleType)?.label || '';

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Hata', 'Lütfen adınızı girin.');
      return;
    }
    if (!city) {
      Alert.alert('Hata', 'Lütfen şehir seçin.');
      return;
    }

    setLoading(true);

    const authPhone = session!.user.phone;
    const { error } = await supabase
      .from('profiles')
      .update({
        name: name.trim(),
        city,
        vehicle_type: vehicleType || null,
        ...(authPhone ? { phone: authPhone } : {}),
      })
      .eq('id', session!.user.id);

    setLoading(false);

    if (error) {
      Alert.alert('Hata', error.message);
      return;
    }

    await refreshProfile();
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.icon}>👋</Text>
        <Text style={styles.title}>Hoş Geldiniz!</Text>
        <Text style={styles.subtitle}>Bilgilerinizi tamamlayın</Text>

        <Text style={styles.label}>Adınız Soyadınız</Text>
        <TextInput
          style={styles.input}
          placeholder="Örn: Ahmet Yılmaz"
          placeholderTextColor="#999"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoFocus
        />

        <Text style={styles.label}>Şehir</Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowCityPicker(true)}
          activeOpacity={0.7}
        >
          <Text style={city ? styles.pickerText : styles.pickerPlaceholder}>
            {city || 'Şehir seçin'}
          </Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </TouchableOpacity>

        <Text style={styles.label}>
          Araç Tipi <Text style={styles.optional}>(isteğe bağlı)</Text>
        </Text>
        <Text style={styles.vehicleNote}>
          Araç türü seçimi bildirim tercihleriniz içindir. Herkes hem yük paylaşabilir hem yük alabilir.
        </Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowVehiclePicker(true)}
          activeOpacity={0.7}
        >
          <Text
            style={vehicleType ? styles.pickerText : styles.pickerPlaceholder}
          >
            {vehicleLabel || 'Araç tipi seçin'}
          </Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, (!name.trim() || !city) && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={loading || !name.trim() || !city}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Text style={styles.buttonText}>Kaydet ve Devam Et</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showCityPicker} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Şehir Seçin</Text>
            <TouchableOpacity onPress={() => { setShowCityPicker(false); setCitySearch(''); }}>
              <Text style={styles.modalClose}>Kapat</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Şehir ara..."
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
                style={[styles.listItem, item === city && styles.listItemSelected]}
                onPress={() => {
                  setCity(item);
                  setShowCityPicker(false);
                  setCitySearch('');
                }}
              >
                <Text
                  style={[
                    styles.listItemText,
                    item === city && styles.listItemTextSelected,
                  ]}
                >
                  {item}
                </Text>
                {item === city && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </SafeAreaView>
      </Modal>

      <Modal visible={showVehiclePicker} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Araç Tipi Seçin</Text>
            <TouchableOpacity onPress={() => setShowVehiclePicker(false)}>
              <Text style={styles.modalClose}>Kapat</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={VEHICLE_TYPES}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.vehicleItem,
                  item.value === vehicleType && styles.vehicleItemSelected,
                ]}
                onPress={() => {
                  setVehicleType(item.value);
                  setShowVehiclePicker(false);
                }}
              >
                <Text
                  style={[
                    styles.vehicleItemText,
                    item.value === vehicleType && styles.vehicleItemTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
                {item.value === vehicleType && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  icon: {
    fontSize: 56,
    textAlign: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    color: '#666',
    marginBottom: 36,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
    marginTop: 16,
  },
  optional: {
    fontWeight: '400',
    color: '#999',
  },
  input: {
    height: 56,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    color: '#1A1A1A',
  },
  vehicleNote: {
    fontSize: 14,
    color: '#888',
    lineHeight: 20,
    marginBottom: 12,
  },
  pickerButton: {
    height: 56,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerText: {
    fontSize: 18,
    color: '#1A1A1A',
  },
  pickerPlaceholder: {
    fontSize: 18,
    color: '#999',
  },
  pickerArrow: {
    fontSize: 14,
    color: '#999',
  },
  button: {
    height: 56,
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
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
    color: '#FF6B35',
    fontWeight: '600',
  },
  searchInput: {
    height: 48,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    color: '#1A1A1A',
    margin: 16,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  listItemSelected: {
    backgroundColor: '#FFF5F0',
  },
  listItemText: {
    fontSize: 18,
    color: '#1A1A1A',
  },
  listItemTextSelected: {
    color: '#FF6B35',
    fontWeight: '600',
  },
  vehicleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  vehicleItemSelected: {
    backgroundColor: '#FFF5F0',
  },
  vehicleItemText: {
    fontSize: 18,
    color: '#1A1A1A',
  },
  vehicleItemTextSelected: {
    color: '#FF6B35',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 20,
    color: '#FF6B35',
    fontWeight: '700',
  },
  separator: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 24,
  },
});
