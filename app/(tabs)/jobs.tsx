import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  SectionList,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/services/supabase';
import { useLoadContactCounts } from '@/hooks/useLoadContactCounts';
import {
  LoadWithDetails,
  ProfileSnippet,
  formatWeight,
  timeAgo,
} from '@/types/load';

const PRIMARY = '#2563EB';
const GREEN = '#16A34A';

type TabKey = 'posted' | 'taken';
type LoadSection = { title: string; data: LoadWithDetails[] };

// ────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────

function statusOrder(status: string): number {
  if (status === 'active' || status === 'has_offers') return 0;
  if (status === 'assigned' || status === 'in_transit') return 1;
  if (status === 'delivered') return 2;
  return 3;
}

function sortLoads(items: LoadWithDetails[]): LoadWithDetails[] {
  return [...items].sort((a, b) => {
    const d = statusOrder(a.status) - statusOrder(b.status);
    return d !== 0
      ? d
      : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

async function fetchProfileMap(
  ids: string[],
): Promise<Map<string, ProfileSnippet>> {
  const map = new Map<string, ProfileSnippet>();
  if (!ids.length) return map;
  const { data } = await supabase
    .from('profiles')
    .select('id, name, phone, rating_avg')
    .in('id', ids);
  (data ?? []).forEach((p) => map.set(p.id, p));
  return map;
}

function enrichLoads(
  rows: any[],
  pm: Map<string, ProfileSnippet>,
): LoadWithDetails[] {
  return rows.map((l) => ({
    ...l,
    ownerName: pm.get(l.user_id)?.name ?? 'Bilinmiyor',
    ownerPhone: pm.get(l.user_id)?.phone ?? '',
    ownerRatingAvg: pm.get(l.user_id)?.rating_avg ?? null,
    assignedDriverName: l.assigned_to
      ? pm.get(l.assigned_to)?.name
      : undefined,
    assignedDriverPhone: l.assigned_to
      ? pm.get(l.assigned_to)?.phone
      : undefined,
    assignedDriverRatingAvg: l.assigned_to
      ? (pm.get(l.assigned_to)?.rating_avg ?? null)
      : undefined,
  }));
}

function buildSections(loads: LoadWithDetails[]): LoadSection[] {
  const active = loads.filter((l) => l.status !== 'delivered');
  const delivered = loads.filter((l) => l.status === 'delivered');
  const sections: LoadSection[] = [];
  if (active.length) sections.push({ title: '', data: active });
  if (delivered.length)
    sections.push({ title: '', data: delivered });
  return sections;
}

function formatPhoneForDial(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
  if (digits.startsWith('90') && digits.length >= 12) return `+${digits}`;
  if (digits.length === 10) return `+90${digits}`;
  return digits ? `+${digits}` : '';
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'active':
    case 'has_offers':
      return { label: 'Aktif', bg: '#E6F9E6', color: '#22C55E' };
    case 'assigned':
    case 'in_transit':
      return { label: 'İş Verildi', bg: '#EFF6FF', color: '#2563EB' };
    default:
      return { label: 'Teslim Edildi', bg: '#F3F4F6', color: '#6B7280' };
  }
}

// ────────────────────────────────────────────────────────
// Data hook — fetches loads by a given field (user_id or assigned_to)
// ────────────────────────────────────────────────────────

function useLoadsByField(
  field: 'user_id' | 'assigned_to',
  userId: string | undefined,
  channelName: string,
) {
  const [loads, setLoads] = useState<LoadWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const alive = useRef(true);

  const fetchLoads = useCallback(async () => {
    if (!userId) {
      if (alive.current) {
        setLoads([]);
        setIsLoading(false);
      }
      return;
    }

    const { data, error } = await supabase
      .from('loads')
      .select('*')
      .eq(field, userId)
      .in('status', [
        'active',
        'has_offers',
        'assigned',
        'in_transit',
        'delivered',
      ])
      .order('created_at', { ascending: false });

    if (error || !data?.length) {
      if (alive.current) {
        setLoads([]);
        setIsLoading(false);
      }
      return;
    }

    const allIds = new Set<string>();
    data.forEach((l) => {
      allIds.add(l.user_id);
      if (l.assigned_to) allIds.add(l.assigned_to);
    });

    const profileMap = await fetchProfileMap([...allIds]);
    const result = sortLoads(enrichLoads(data, profileMap));

    if (alive.current) {
      setLoads(result);
      setIsLoading(false);
    }
  }, [field, userId]);

  useEffect(() => {
    alive.current = true;
    setIsLoading(true);
    fetchLoads();

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'loads' },
        () => fetchLoads(),
      )
      .subscribe();

    return () => {
      alive.current = false;
      supabase.removeChannel(channel);
    };
  }, [fetchLoads, channelName]);

  const removeLoad = useCallback((loadId: string) => {
    setLoads((prev) => prev.filter((l) => l.id !== loadId));
  }, []);

  return { loads, isLoading, refresh: fetchLoads, removeLoad };
}

// ────────────────────────────────────────────────────────
// PostedLoadCard — "Paylaştığım İşler" tab
// ────────────────────────────────────────────────────────

function PostedLoadCard({
  load,
  onRemove,
  contactCount,
}: {
  load: LoadWithDetails;
  onRemove: (loadId: string) => void;
  contactCount?: number;
}) {
  const router = useRouter();
  const isDelivered = load.status === 'delivered';
  const isAssigned =
    load.status === 'assigned' || load.status === 'in_transit';
  const canModify = ['active', 'has_offers'].includes(load.status);
  const canOpenDetail = ['active', 'has_offers'].includes(load.status);
  const badge = getStatusBadge(load.status);

  const handleEdit = () => {
    if (!canModify) {
      Alert.alert('Uyarı', 'İş verilmiş yükler düzenlenemez.');
      return;
    }
    router.push({ pathname: '/edit-load', params: { loadId: load.id } });
  };

  const handleDelete = () => {
    if (!canModify) {
      Alert.alert('Uyarı', 'İş verilmiş yükler silinemez.');
      return;
    }
    Alert.alert(
      'Yükü Sil',
      'Bu yükü silmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('loads')
              .delete()
              .eq('id', load.id);
            if (error) {
              Alert.alert('Hata', error.message || 'Silme işlemi başarısız.');
              return;
            }
            onRemove(load.id);
          },
        },
      ],
    );
  };

  const openDetail = () => {
    if (canOpenDetail) router.push({ pathname: '/my-load-detail', params: { loadId: load.id } });
  };

  const cardContent = (
    <>
      <View style={styles.cardTopRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.routeRow}>
            <View style={[styles.dot, styles.dotOrigin]} />
            <Text
              style={[styles.routeText, isDelivered && styles.textDimmed]}
            >
              {load.from_city} / {load.from_district}
            </Text>
          </View>
          <View style={styles.routeRow}>
            <View style={[styles.dot, styles.dotDest]} />
            <Text
              style={[styles.routeText, isDelivered && styles.textDimmed]}
            >
              {load.to_city} / {load.to_district}
            </Text>
          </View>
        </View>
        {canModify && (
          <View style={styles.cardActions}>
            <TouchableOpacity
              onPress={handleEdit}
              style={styles.cardActionBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="create-outline" size={18} color="#6B7280" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDelete}
              style={styles.cardActionBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={18} color="#DC2626" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.cardMeta}>
        <View style={[styles.statusPill, { backgroundColor: badge.bg }]}>
          <Text style={[styles.statusPillText, { color: badge.color }]}>
            {badge.label}
          </Text>
        </View>
        {canOpenDetail && (contactCount ?? 0) > 0 && (
          <View style={styles.contactBadge}>
            <Text style={styles.contactBadgeText}>
              {contactCount} kişi ilgilendi
            </Text>
          </View>
        )}
        <View style={styles.metaRight}>
          <MaterialCommunityIcons
            name="package-variant"
            size={15}
            color={isDelivered ? '#9CA3AF' : '#6B7280'}
          />
          <Text style={[styles.metaText, isDelivered && styles.textDimmed]}>
            {formatWeight(load.weight_kg)}
          </Text>
          <Ionicons
            name="time-outline"
            size={14}
            color={isDelivered ? '#9CA3AF' : '#6B7280'}
            style={{ marginLeft: 10 }}
          />
          <Text style={[styles.metaText, isDelivered && styles.textDimmed]}>
            {timeAgo(load.created_at)}
          </Text>
        </View>
      </View>

      {isAssigned && load.assignedDriverName ? (
        <View style={styles.driverRow}>
          <Ionicons name="person-circle-outline" size={18} color="#6B7280" />
          <Text style={styles.driverText}>
            Sürücü: {load.assignedDriverName}
          </Text>
        </View>
      ) : null}

      {isAssigned ? (
        <View style={styles.waitingRow}>
          <Ionicons name="hourglass-outline" size={16} color="#9CA3AF" />
          <Text style={styles.waitingText}>Teslim bekleniyor...</Text>
        </View>
      ) : null}
    </>
  );

  if (canOpenDetail) {
    return (
      <TouchableOpacity
        style={[styles.card, isDelivered && styles.cardDimmed]}
        onPress={openDetail}
        activeOpacity={0.8}
      >
        {cardContent}
      </TouchableOpacity>
    );
  }
  return <View style={[styles.card, isDelivered && styles.cardDimmed]}>{cardContent}</View>;
}

// ────────────────────────────────────────────────────────
// TakenLoadCard — "Aldığım İşler" tab
// ────────────────────────────────────────────────────────

function TakenLoadCard({
  load,
  currentUserId,
  onRefresh,
}: {
  load: LoadWithDetails;
  currentUserId: string;
  onRefresh: () => void;
}) {
  const router = useRouter();
  const [completing, setCompleting] = useState(false);

  const isDelivered = load.status === 'delivered';
  const isAssigned =
    load.status === 'assigned' || load.status === 'in_transit';

  const openChat = () => {
    router.push({
      pathname: '/chat',
      params: {
        loadId: load.id,
        otherUserId: load.user_id,
        otherUserName: load.ownerName,
        otherUserPhone: load.ownerPhone,
        fromCity: load.from_city,
        fromDistrict: load.from_district,
        toCity: load.to_city,
        toDistrict: load.to_district,
      },
    });
  };

  const handleCall = async () => {
    let phone = load.ownerPhone;
    if (!phone) {
      const { data } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', load.user_id)
        .single();
      phone = data?.phone ?? '';
    }
    if (load.user_id && load.id) {
      const payload = {
        sender_id: currentUserId,
        receiver_id: load.user_id,
        load_id: load.id,
        content: '📞 Arama yapıldı',
        message_type: 'call_attempt',
      };
      const { data: insertData, error: insertError } = await supabase
        .from('messages')
        .insert(payload)
        .select('id, sender_id, receiver_id, load_id, message_type, created_at')
        .single();
      console.log('[jobs TakenLoadCard] call_attempt insert', {
        payload,
        ok: !insertError,
        data: insertData,
        error: insertError?.message ?? null,
      });
    }
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

  const handleComplete = () => {
    Alert.alert(
      'Teslim Onayı',
      'Bu yükü teslim ettiğinizi onaylıyor musunuz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Onayla',
          onPress: async () => {
            setCompleting(true);
            try {
              const { data, error } = await supabase
                .from('loads')
                .update({
                  status: 'delivered',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', load.id)
                .eq('assigned_to', currentUserId)
                .select();

              if (error) {
                Alert.alert('Hata', error.message || 'İşlem başarısız.');
                return;
              }
              if (!data || data.length === 0) {
                Alert.alert(
                  'Hata',
                  'Güncelleme yapılamadı. Yetki hatası olabilir.',
                );
                return;
              }

              await supabase.from('messages').insert({
                sender_id: currentUserId,
                receiver_id: load.user_id,
                load_id: load.id,
                content: '✅ Bu yük teslim edildi olarak işaretlendi.',
                message_type: 'system',
              });

              onRefresh();
            } catch (err: unknown) {
              Alert.alert(
                'Hata',
                err instanceof Error ? err.message : 'Bir hata oluştu.',
              );
            } finally {
              setCompleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.card, styles.takenCard, isDelivered && styles.cardDimmed]}>
      <View style={[styles.routeRow, styles.takenRouteRow]}>
        <View style={[styles.dot, styles.dotOrigin]} />
        <Text style={[styles.routeText, isDelivered && styles.textDimmed]}>
          {load.from_city} / {load.from_district}
        </Text>
      </View>
      <View style={[styles.routeRow, styles.takenRouteRow]}>
        <View style={[styles.dot, styles.dotDest]} />
        <Text style={[styles.routeText, isDelivered && styles.textDimmed]}>
          {load.to_city} / {load.to_district}
        </Text>
      </View>

      <View style={[styles.weightTimeRow, styles.takenWeightTimeRow]}>
        <MaterialCommunityIcons
          name="package-variant"
          size={15}
          color={isDelivered ? '#9CA3AF' : '#6B7280'}
        />
        <Text style={[styles.metaText, isDelivered && styles.textDimmed]}>
          {formatWeight(load.weight_kg)}
        </Text>
        <Ionicons
          name="time-outline"
          size={14}
          color={isDelivered ? '#9CA3AF' : '#6B7280'}
          style={{ marginLeft: 6 }}
        />
        <Text style={[styles.metaText, isDelivered && styles.textDimmed]}>
          {timeAgo(load.created_at)}
        </Text>
      </View>

      <View style={[styles.ownerSection, styles.takenOwnerSection]}>
        <Text style={[styles.ownerLabel, styles.takenOwnerLabel]}>İlan Sahibi</Text>
        <Text style={[styles.ownerName, isDelivered && styles.textDimmed]}>
          {load.ownerName}
        </Text>
        {load.ownerPhone && !isDelivered ? (
          <Text style={[styles.ownerPhone, styles.takenOwnerPhone]}>{load.ownerPhone}</Text>
        ) : null}
      </View>

      {!isDelivered && (
        <View style={[styles.buttonRow, styles.takenButtonRow]}>
          <TouchableOpacity
            style={styles.mesajButton}
            onPress={openChat}
            activeOpacity={0.8}
          >
            <Ionicons name="chatbubble" size={18} color="#FFFFFF" />
            <Text style={styles.mesajButtonText}>Mesaj Gönder</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.araButton}
            onPress={handleCall}
            activeOpacity={0.8}
          >
            <Ionicons name="call" size={20} color="#FFFFFF" />
            <Text style={styles.araButtonText}>Ara</Text>
          </TouchableOpacity>
        </View>
      )}

      {isAssigned && currentUserId === load.assigned_to && (
        <TouchableOpacity
          style={[styles.completeButton, styles.takenCompleteButton]}
          onPress={handleComplete}
          disabled={completing}
          activeOpacity={0.8}
        >
          {completing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.completeButtonText}>Tamamlandı</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {isDelivered && (
        <View style={[styles.deliveredRow, styles.takenDeliveredRow]}>
          <View style={styles.deliveredBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#6B7280" />
            <Text style={styles.deliveredBadgeText}>Teslim Edildi</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ────────────────────────────────────────────────────────
// Main Screen
// ────────────────────────────────────────────────────────

export default function JobsScreen() {
  const { session } = useAuth();
  const currentUserId = session?.user?.id ?? '';

  const [activeTab, setActiveTab] = useState<TabKey>('posted');

  const posted = useLoadsByField(
    'user_id',
    currentUserId,
    `jobs-posted-${currentUserId}`,
  );
  const taken = useLoadsByField(
    'assigned_to',
    currentUserId,
    `jobs-taken-${currentUserId}`,
  );

  const current = activeTab === 'posted' ? posted : taken;
  const sections = buildSections(current.loads);

  const activePostedLoadIds = posted.loads
    .filter((l) => ['active', 'has_offers'].includes(l.status))
    .map((l) => l.id);
  const contactCounts = useLoadContactCounts(activePostedLoadIds, currentUserId);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([posted.refresh(), taken.refresh()]);
    setRefreshing(false);
  }, [posted.refresh, taken.refresh]);

  useFocusEffect(
    useCallback(() => {
      posted.refresh();
      taken.refresh();
    }, [posted.refresh, taken.refresh]),
  );

  const switchTab = useCallback(
    (tab: TabKey) => {
      setActiveTab(tab);
      if (tab === 'posted') posted.refresh();
      else taken.refresh();
    },
    [posted.refresh, taken.refresh],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: LoadSection }) =>
      section.title ? (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>{section.title}</Text>
        </View>
      ) : null,
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: LoadWithDetails }) => {
      if (activeTab === 'posted') {
        return (
          <PostedLoadCard
            load={item}
            onRemove={posted.removeLoad}
            contactCount={contactCounts[item.id]}
          />
        );
      }
      return (
        <TakenLoadCard
          load={item}
          currentUserId={currentUserId}
          onRefresh={taken.refresh}
        />
      );
    },
    [activeTab, currentUserId, posted.removeLoad, taken.refresh, contactCounts],
  );

  const postedCount = posted.loads.length;
  const takenCount = taken.loads.length;

  const emptyTitle =
    activeTab === 'posted' ? 'Henüz yük paylaşmadınız' : 'Henüz iş almadınız';
  const emptySubtitle =
    activeTab === 'posted'
      ? 'Yeni yük paylaşarak başlayın'
      : 'Odalardaki yüklere teklif vererek iş alın';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>İşlerim</Text>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'posted' && styles.tabActive]}
          onPress={() => switchTab('posted')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'posted' && styles.tabTextActive,
            ]}
          >
            Paylaştığım İşler ({postedCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'taken' && styles.tabActive]}
          onPress={() => switchTab('taken')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'taken' && styles.tabTextActive,
            ]}
          >
            Aldığım İşler ({takenCount})
          </Text>
        </TouchableOpacity>
      </View>

      {current.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.center}>
          <Ionicons
            name={
              activeTab === 'posted' ? 'cube-outline' : 'briefcase-outline'
            }
            size={56}
            color="#D1D5DB"
          />
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          <Text style={styles.emptySubtitle}>{emptySubtitle}</Text>
        </View>
      ) : (
        <SectionList
          key={activeTab}
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
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

// ────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────

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
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A1A',
  },

  // ── Tab bar ──
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: PRIMARY,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  tabTextActive: {
    color: PRIMARY,
  },

  // ── Section header ──
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Card base ──
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  takenCard: {
    padding: 10,
  },
  cardDimmed: {
    opacity: 0.65,
  },

  // ── Card top row (route + actions) ──
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: 8,
    marginTop: 2,
  },
  cardActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Route rows ──
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  takenRouteRow: {
    marginBottom: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
    flexShrink: 0,
  },
  dotOrigin: {
    backgroundColor: '#16A34A',
  },
  dotDest: {
    backgroundColor: '#DC2626',
  },
  routeText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  textDimmed: {
    color: '#9CA3AF',
  },

  // ── Posted card: meta row with badge ──
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 10,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  metaRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  metaText: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 4,
  },
  contactBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  contactBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284C7',
  },

  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  driverText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },

  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  waitingText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },

  // ── Taken card: weight + time row ──
  weightTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  takenWeightTimeRow: {
    marginTop: 4,
    marginBottom: 2,
  },

  // ── Taken card: owner section ──
  ownerSection: {
    marginTop: 8,
    marginBottom: 12,
  },
  takenOwnerSection: {
    marginTop: 4,
    marginBottom: 4,
  },
  ownerLabel: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  takenOwnerLabel: {
    marginBottom: 1,
  },
  ownerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  ownerPhone: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 1,
  },
  takenOwnerPhone: {
    marginTop: 0,
  },

  // ── Buttons ──
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  takenButtonRow: {
    marginTop: 4,
    gap: 8,
  },
  mesajButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: PRIMARY,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mesajButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  araButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GREEN,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  araButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GREEN,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 10,
    gap: 8,
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  takenCompleteButton: {
    marginTop: 4,
    paddingVertical: 8,
  },

  deliveredRow: {
    alignItems: 'center',
    marginTop: 10,
  },
  takenDeliveredRow: {
    marginTop: 4,
  },
  deliveredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  deliveredBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },

  // ── Empty / loading ──
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
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
    paddingTop: 4,
    paddingBottom: 24,
  },
});
