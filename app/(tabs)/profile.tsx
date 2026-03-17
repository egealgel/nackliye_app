import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Modal,
  FlatList,
  TextInput,
  SafeAreaView,
  Linking,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/services/supabase';
import { VEHICLE_TYPES } from '@/constants/vehicleTypes';
import { TURKISH_CITIES } from '@/constants/turkishCities';
import BrandHeader from '@/components/BrandHeader';

export default function ProfileScreen() {
  const { profile, signOut, refreshProfile, session } = useAuth();
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [citySearch, setCitySearch] = useState('');

  useFocusEffect(
    useCallback(() => {
      refreshProfile();
    }, [refreshProfile])
  );

  const vehicleLabel =
    VEHICLE_TYPES.find((v) => v.value === profile?.vehicle_type)?.profileLabel;

  const filteredCities = TURKISH_CITIES.filter((c) =>
    c.toLowerCase().includes(citySearch.toLowerCase())
  );

  const updateField = async (field: string, value: string | null) => {
    const { error } = await supabase
      .from('profiles')
      .update({ [field]: value })
      .eq('id', session!.user.id);
    if (error) {
      Alert.alert('Hata', error.message);
      return;
    }
    await refreshProfile();
  };

  const handleSignOut = () => {
    Alert.alert('Çıkış', 'Çıkış yapmak istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Çıkış Yap',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/phone');
        },
      },
    ]);
  };

  const rawPhone = profile?.phone || session?.user?.phone;
  const formatPhone = (s: string | undefined): string => {
    if (!s) return '-';
    const digits = s.replace(/\D/g, '');
    if (digits.length < 10) return s;
    const d = digits.startsWith('90') ? digits.slice(2) : digits;
    if (d.length === 10) return `+90 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
    return `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  };
  const phone = formatPhone(rawPhone);

  return (
    <View style={styles.container}>
      <BrandHeader title="yüküstü" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {profile?.name?.charAt(0)?.toUpperCase() ?? '?'}
        </Text>
      </View>

      <Text style={styles.name}>{profile?.name ?? 'Kullanıcı'}</Text>

      <View style={styles.statsCard}>
        <View style={styles.statsLeft}>
          <Text style={styles.statsLabel}>Ortalama Puan</Text>
          <Text style={styles.statsValue}>
            {(profile?.rating_avg ?? 0) > 0
              ? `⭐ ${Number(profile?.rating_avg ?? 0).toFixed(1)}`
              : '-'}
          </Text>
        </View>
        <View style={styles.statsDivider} />
        <View style={styles.statsRight}>
          <Text style={styles.statsLabel}>Tamamlanan İşler</Text>
          <Text style={styles.statsValue}>{profile?.total_jobs ?? 0}</Text>
        </View>
      </View>

      {/* Info Card */}
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.iconBox}>
            <Ionicons name="call-outline" size={20} color="#2563EB" />
          </View>
          <Text style={styles.label}>Telefon</Text>
          <Text style={styles.value} numberOfLines={1}>{phone}</Text>
        </View>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.row}
          onPress={() => setShowCityPicker(true)}
          activeOpacity={0.6}
        >
          <View style={styles.iconBox}>
            <Ionicons name="location-outline" size={20} color="#2563EB" />
          </View>
          <Text style={styles.label}>Şehir</Text>
          <Text style={styles.value} numberOfLines={1}>{profile?.city ?? '-'}</Text>
          <Ionicons name="chevron-forward" size={18} color="#CCC" style={styles.chevron} />
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.row}
          onPress={() => setShowVehiclePicker(true)}
          activeOpacity={0.6}
        >
          <View style={styles.iconBox}>
            <Ionicons name="car-outline" size={20} color="#2563EB" />
          </View>
          <Text style={styles.label}>Araç Tipi</Text>
          <Text style={styles.value} numberOfLines={1}>
            {vehicleLabel ?? 'Belirtilmedi'}
          </Text>
          <Ionicons name="chevron-forward" size={18} color="#CCC" style={styles.chevron} />
        </TouchableOpacity>
      </View>

      {/* Sign Out */}
      <TouchableOpacity
        style={styles.signOutRow}
        onPress={handleSignOut}
        activeOpacity={0.6}
      >
        <View style={[styles.iconBox, styles.signOutIconBox]}>
          <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
        </View>
        <Text style={styles.signOutText}>Çıkış Yap</Text>
      </TouchableOpacity>

      {/* City Picker */}
      <Modal visible={showCityPicker} animationType="slide">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Şehir Seç</Text>
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
                style={[styles.listItem, item === profile?.city && styles.listItemSelected]}
                onPress={() => {
                  updateField('city', item);
                  setShowCityPicker(false);
                  setCitySearch('');
                }}
              >
                <Text style={[styles.listItemText, item === profile?.city && styles.listItemTextSelected]}>
                  {item}
                </Text>
                {item === profile?.city && (
                  <Ionicons name="checkmark" size={22} color="#2563EB" />
                )}
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </SafeAreaView>
      </Modal>

      {/* Vehicle Picker */}
      <Modal visible={showVehiclePicker} animationType="slide">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Araç Tipi Seç</Text>
            <TouchableOpacity onPress={() => setShowVehiclePicker(false)}>
              <Text style={styles.modalClose}>Kapat</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.modalNote}>
            Araç türü seçimi bildirim tercihleriniz içindir. Herkes hem yük paylaşabilir hem yük alabilir.
          </Text>
          <FlatList
            data={VEHICLE_TYPES}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.listItem, item.value === profile?.vehicle_type && styles.listItemSelected]}
                onPress={() => {
                  updateField('vehicle_type', item.value);
                  setShowVehiclePicker(false);
                }}
              >
                <Text style={[styles.listItemText, item.value === profile?.vehicle_type && styles.listItemTextSelected]}>
                  {item.label}
                </Text>
                {item.value === profile?.vehicle_type && (
                  <Ionicons name="checkmark" size={22} color="#2563EB" />
                )}
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </SafeAreaView>
      </Modal>
      </ScrollView>

      <TouchableOpacity
        style={styles.supportRow}
        onPress={() => Linking.openURL('mailto:destek@yukustu.com.tr')}
        activeOpacity={0.7}
      >
        <Text style={styles.supportText}>İletişim: destek@yukustu.com.tr</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  scroll: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    paddingTop: 32,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  supportRow: {
    marginTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  supportText: {
    color: '#9CA3AF',
    fontSize: 13,
    textAlign: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 20,
  },
  statsCard: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    paddingVertical: 20,
    marginBottom: 24,
  },
  statsLeft: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRight: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsLabel: {
    fontSize: 13,
    color: '#888',
    marginBottom: 6,
  },
  statsValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  statsDivider: {
    width: 1,
    backgroundColor: '#EEEEEE',
    alignSelf: 'stretch',
    marginVertical: 4,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 16,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  label: {
    fontSize: 15,
    color: '#888',
    width: 72,
  },
  value: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'right',
  },
  chevron: {
    marginLeft: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginLeft: 64,
  },
  signOutRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  signOutIconBox: {
    backgroundColor: '#FFF0F0',
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
  modal: {
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
    color: '#2563EB',
    fontWeight: '600',
  },
  modalNote: {
    fontSize: 14,
    color: '#888',
    lineHeight: 20,
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
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
    paddingVertical: 20,
  },
  listItemSelected: {
    backgroundColor: '#FFF5F0',
  },
  listItemText: {
    fontSize: 18,
    color: '#1A1A1A',
    flex: 1,
  },
  listItemTextSelected: {
    color: '#2563EB',
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 24,
  },
});
