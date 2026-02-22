import { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/services/supabase';
import { VEHICLE_TYPES } from '@/constants/vehicleTypes';
import { TURKISH_CITIES } from '@/constants/turkishCities';
import { timeAgo } from '@/types/load';

type ReceivedReview = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_name: string;
};

export default function ProfileScreen() {
  const { profile, signOut, refreshProfile, session } = useAuth();
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [reviews, setReviews] = useState<ReceivedReview[]>([]);

  const fetchReviews = useCallback(async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from('reviews')
      .select('id, rating, comment, created_at, reviewer_id')
      .eq('reviewed_id', session.user.id)
      .order('created_at', { ascending: false });
    if (!data?.length) {
      setReviews([]);
      return;
    }
    const ids = [...new Set(data.map((r) => r.reviewer_id))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', ids);
    const nameMap = new Map(
      (profilesData || []).map((p) => [p.id, p.name || 'Anonim'])
    );
    setReviews(
      data.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        created_at: r.created_at,
        reviewer_name: nameMap.get(r.reviewer_id) || 'Anonim',
      }))
    );
  }, [session?.user?.id]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useFocusEffect(
    useCallback(() => {
      refreshProfile();
      fetchReviews();
    }, [refreshProfile, fetchReviews])
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
            <Ionicons name="call-outline" size={20} color="#FF6B35" />
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
            <Ionicons name="location-outline" size={20} color="#FF6B35" />
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
            <Ionicons name="car-outline" size={20} color="#FF6B35" />
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

      {/* Received Reviews */}
      {reviews.length > 0 && (
        <View style={styles.reviewsSection}>
          <Text style={styles.reviewsSectionTitle}>Aldığım Puanlar</Text>
          {reviews.map((r) => (
            <View key={r.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewerName}>{r.reviewer_name}</Text>
                <Text style={styles.reviewDate}>{timeAgo(r.created_at)}</Text>
              </View>
              <View style={styles.reviewStars}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Ionicons
                    key={s}
                    name={r.rating >= s ? 'star' : 'star-outline'}
                    size={16}
                    color="#F59E0B"
                  />
                ))}
              </View>
              {r.comment && (
                <Text style={styles.reviewComment}>{r.comment}</Text>
              )}
            </View>
          ))}
        </View>
      )}

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
                  <Ionicons name="checkmark" size={22} color="#FF6B35" />
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
                  <Ionicons name="checkmark" size={22} color="#FF6B35" />
                )}
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </SafeAreaView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  content: {
    alignItems: 'center',
    paddingTop: 32,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF6B35',
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
    color: '#FF6B35',
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
    color: '#FF6B35',
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 24,
  },
  reviewsSection: {
    width: '100%',
    marginBottom: 24,
  },
  reviewsSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  reviewDate: {
    fontSize: 13,
    color: '#888',
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 8,
  },
  reviewComment: {
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
  },
});
