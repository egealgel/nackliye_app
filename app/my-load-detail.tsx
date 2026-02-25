import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/services/supabase';
import { useLoadMessageSenders } from '@/hooks/useLoadMessageSenders';
import {
  LoadWithDetails,
  formatWeight,
  VEHICLE_LABELS,
  isBosAracLoad,
} from '@/types/load';

const PRIMARY = '#2563EB';
const GREEN = '#16A34A';

function formatPhoneForDial(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
  if (digits.startsWith('90') && digits.length >= 12) return `+${digits}`;
  if (digits.length === 10) return `+90${digits}`;
  return digits ? `+${digits}` : '';
}

async function fetchLoadWithDetails(loadId: string): Promise<LoadWithDetails | null> {
  const { data: load, error } = await supabase
    .from('loads')
    .select('*')
    .eq('id', loadId)
    .single();

  if (error || !load) return null;

  const ids = [load.user_id, load.assigned_to].filter(Boolean) as string[];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, phone, rating_avg')
    .in('id', ids);

  const pm = new Map((profiles ?? []).map((p) => [p.id, p]));
  return {
    ...load,
    ownerName: pm.get(load.user_id)?.name ?? 'Bilinmiyor',
    ownerPhone: pm.get(load.user_id)?.phone ?? '',
    ownerRatingAvg: pm.get(load.user_id)?.rating_avg ?? null,
    assignedDriverName: load.assigned_to ? pm.get(load.assigned_to)?.name : undefined,
    assignedDriverPhone: load.assigned_to ? pm.get(load.assigned_to)?.phone : undefined,
    assignedDriverRatingAvg: load.assigned_to
      ? (pm.get(load.assigned_to)?.rating_avg ?? null)
      : undefined,
  };
}

export default function MyLoadDetailScreen() {
  const { loadId } = useLocalSearchParams<{ loadId: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const currentUserId = session?.user?.id ?? '';

  const [load, setLoad] = useState<LoadWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);

  const { senders, refresh: refreshSenders } = useLoadMessageSenders(
    loadId && load ? load.id : null,
    load?.user_id ?? null,
  );

  const loadData = useCallback(async () => {
    if (!loadId) return;
    setLoading(true);
    const l = await fetchLoadWithDetails(loadId);
    setLoad(l);
    setLoading(false);
  }, [loadId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handleAssign = (driverId: string, driverName: string) => {
    Alert.alert(
      'İş Ver',
      `Bu işi ${driverName} adlı kullanıcıya vermek istediğinize emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Onayla', style: 'default', onPress: () => doAssign(driverId) },
      ],
    );
  };

  const doAssign = async (driverId: string) => {
    if (!loadId || !load) return;
    setAssigning(driverId);
    try {
      const { error } = await supabase
        .from('loads')
        .update({
          status: 'assigned',
          assigned_to: driverId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', load.id);

      if (error) throw error;

      await supabase.from('messages').insert({
        sender_id: currentUserId,
        receiver_id: driverId,
        load_id: load.id,
        content: '✅ Bu iş size verildi.',
        message_type: 'system',
      });

      const bodyText = isBosAracLoad(load)
        ? (load.description?.slice(0, 50) || 'Boş araç ilanı') + (load.description && load.description.length > 50 ? '…' : '')
        : `${load.from_city ?? ''}${load.from_district ? '/' + load.from_district : ''} → ${load.to_city ?? ''}${load.to_district ? '/' + load.to_district : ''}`;
      try {
        await supabase.functions.invoke('send-notification', {
          body: {
            user_id: driverId,
            title: 'Yeni bir iş aldınız!',
            body: bodyText,
            data: { type: 'load', loadId: load.id },
          },
        });
      } catch {
        // silent
      }

      await loadData();
      refreshSenders();
    } catch (err: unknown) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Bir hata oluştu.');
    } finally {
      setAssigning(null);
    }
  };

  const openChat = (otherUserId: string, otherName?: string, otherPhone?: string) => {
    if (!load) return;
    router.push({
      pathname: '/chat',
      params: {
        loadId: load.id,
        otherUserId,
        otherUserName: otherName || '',
        otherUserPhone: otherPhone || '',
        fromCity: load.from_city ?? '',
        fromDistrict: load.from_district ?? '',
        toCity: load.to_city ?? '',
        toDistrict: load.to_district ?? '',
      },
    });
  };

  const openCall = async (phone: string) => {
    const tel = formatPhoneForDial(phone);
    if (!tel) {
      Alert.alert('Hata', 'Telefon numarası bulunamadı.');
      return;
    }
    try {
      const canOpen = await Linking.canOpenURL(`tel:${tel}`);
      if (!canOpen) {
        Alert.alert('Bilgi', 'Bu cihazda arama yapılamıyor');
        return;
      }
      await Linking.openURL(`tel:${tel}`);
    } catch {
      Alert.alert('Bilgi', 'Bu cihazda arama yapılamıyor');
    }
  };

  if (loading && !load) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      </SafeAreaView>
    );
  }

  if (!load) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Yük detayı</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>Yük bulunamadı</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isAssigned = load.status === 'assigned' || load.status === 'in_transit' || load.status === 'delivered';
  const isBosArac = isBosAracLoad(load);
  const canAssign = !isBosArac && ['active', 'has_offers'].includes(load.status) && load.user_id === currentUserId;
  const showSenders = ['active', 'has_offers'].includes(load.status) && load.user_id === currentUserId;
  const hasDimensions = load.width_cm || load.length_cm || load.height_cm;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Yük detayı</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {isBosArac ? (
            <>
              <View style={styles.descriptionBox}>
                <Text style={styles.descriptionText}>{load.description || 'Boş araç ilanı'}</Text>
              </View>
              <View style={styles.metaRow}>
                <View
                  style={[
                    styles.statusPill,
                    isAssigned && styles.statusPillAssigned,
                    !isAssigned && load.status === 'active' && styles.statusPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      isAssigned && styles.statusPillTextAssigned,
                      !isAssigned && load.status === 'active' && styles.statusPillTextActive,
                    ]}
                  >
                    {isAssigned ? 'İş Verildi' : load.status === 'has_offers' ? 'Teklif Var' : 'Aktif'}
                  </Text>
                </View>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>İlan sahibi</Text>
                <Text style={styles.detailValue}>{load.ownerName}</Text>
              </View>
            </>
          ) : (
            <>
          <View style={styles.routeRow}>
            <View style={[styles.dot, styles.dotOrigin]} />
            <Text style={styles.routeText}>
              {load.from_city ?? ''} / {load.from_district || load.from_city || ''}
            </Text>
          </View>
          <View style={styles.routeRow}>
            <View style={[styles.dot, styles.dotDest]} />
            <Text style={styles.routeText}>
              {load.to_city ?? ''} / {load.to_district || load.to_city || ''}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <View
              style={[
                styles.statusPill,
                isAssigned && styles.statusPillAssigned,
                !isAssigned && load.status === 'active' && styles.statusPillActive,
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  isAssigned && styles.statusPillTextAssigned,
                  !isAssigned && load.status === 'active' && styles.statusPillTextActive,
                ]}
              >
                {isAssigned ? 'İş Verildi' : load.status === 'has_offers' ? 'Teklif Var' : 'Aktif'}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="package-variant" size={16} color="#6B7280" />
              <Text style={styles.metaText}>{formatWeight(load.weight_kg)}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Araç tipi</Text>
            <Text style={styles.detailValue}>
              {VEHICLE_LABELS[load.vehicle_type as keyof typeof VEHICLE_LABELS] || load.vehicle_type}
            </Text>
          </View>

          {hasDimensions && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Boyut</Text>
              <Text style={styles.detailValue}>
                {[load.width_cm, load.length_cm, load.height_cm].filter(Boolean).join(' × ')} cm
              </Text>
            </View>
          )}

          {load.description ? (
            <View style={styles.descriptionBox}>
              <Text style={styles.descriptionText}>{load.description}</Text>
            </View>
          ) : null}

          {load.photos && load.photos.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosRow}>
              {load.photos.map((uri, i) => (
                <Image key={`${uri}-${i}`} source={{ uri }} style={styles.photo} />
              ))}
            </ScrollView>
          ) : null}
            </>
          )}
        </View>

        {isAssigned && load.assignedDriverName ? (
          <View style={styles.assignedBadge}>
            <Ionicons name="checkmark-circle" size={22} color={PRIMARY} />
            <Text style={styles.assignedBadgeText}>İş Verildi — {load.assignedDriverName}</Text>
          </View>
        ) : null}

        {showSenders ? (
          <>
            <Text style={styles.sectionTitle}>İletişim kuranlar</Text>
            {senders.length === 0 ? (
              <Text style={styles.emptySenders}>
                Henüz mesaj veya arama yok. Sürücüler size mesaj gönderdiğinde veya Ara'ya tıkladığında burada listelenecek.
              </Text>
            ) : (
              senders.map((s) => (
                <View key={s.id} style={styles.senderRow}>
                  <View style={styles.senderInfo}>
                    <View style={styles.senderNameRow}>
                      <Text style={styles.senderName}>{s.name}</Text>
                      <View style={styles.senderIcons}>
                        {s.hasMessage && (
                          <Ionicons name="chatbubble" size={14} color="#6B7280" style={styles.senderIcon} />
                        )}
                        {s.hasCallAttempt && (
                          <Ionicons name="call" size={14} color="#6B7280" style={styles.senderIcon} />
                        )}
                      </View>
                    </View>
                    {(s.ratingAvg != null && s.ratingAvg > 0) && (
                      <View style={styles.starsRow}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Ionicons
                            key={star}
                            name={(s.ratingAvg ?? 0) >= star ? 'star' : 'star-outline'}
                            size={12}
                            color="#F59E0B"
                          />
                        ))}
                      </View>
                    )}
                    {s.vehicleType ? (
                      <Text style={styles.senderMeta}>
                        {VEHICLE_LABELS[s.vehicleType as keyof typeof VEHICLE_LABELS] || s.vehicleType}
                        {s.city ? ` • ${s.city}` : ''}
                      </Text>
                    ) : s.city ? (
                      <Text style={styles.senderMeta}>{s.city}</Text>
                    ) : null}
                  </View>
                  <View style={styles.senderActions}>
                    <TouchableOpacity
                      style={styles.msgBtn}
                      onPress={() => openChat(s.userId, s.name, s.phone)}
                    >
                      <Ionicons name="chatbubble-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.msgBtnText}>Mesaj</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.callBtn} onPress={() => openCall(s.phone)}>
                      <Ionicons name="call" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                    {canAssign && (
                    <TouchableOpacity
                      style={styles.assignBtn}
                      onPress={() => handleAssign(s.userId, s.name)}
                      disabled={assigning !== null}
                    >
                      {assigning === s.userId ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.assignBtnText}>İş Ver</Text>
                      )}
                    </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F8F8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginLeft: 8 },
  errorText: { fontSize: 16, color: '#6B7280' },
  scroll: { flex: 1 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  dotOrigin: { backgroundColor: '#16A34A' },
  dotDest: { backgroundColor: '#DC2626' },
  routeText: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1F2937' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 12 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#E5E7EB' },
  statusPillActive: { backgroundColor: '#E6F9E6' },
  statusPillAssigned: { backgroundColor: '#16A34A' },
  statusPillText: { fontSize: 12, fontWeight: '700', color: '#374151' },
  statusPillTextActive: { color: '#22C55E' },
  statusPillTextAssigned: { color: '#FFFFFF' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 13, color: '#6B7280' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  detailLabel: { fontSize: 14, color: '#9CA3AF' },
  detailValue: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  descriptionBox: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, marginTop: 12 },
  descriptionText: { fontSize: 14, color: '#4B5563', lineHeight: 20 },
  photosRow: { marginTop: 12 },
  photo: { width: 72, height: 72, borderRadius: 10, marginRight: 8 },
  assignedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
  },
  assignedBadgeText: { fontSize: 16, fontWeight: '700', color: PRIMARY },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 10,
  },
  emptySenders: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    fontStyle: 'italic',
  },
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  senderInfo: { flex: 1 },
  senderNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  senderName: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  senderIcons: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  senderIcon: {},
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 1, marginTop: 2 },
  senderMeta: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  senderActions: { flexDirection: 'row', gap: 8 },
  msgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  msgBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  callBtn: {
    backgroundColor: GREEN,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  assignBtn: {
    backgroundColor: GREEN,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 70,
    alignItems: 'center',
  },
  assignBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
