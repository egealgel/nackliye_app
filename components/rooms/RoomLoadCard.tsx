import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/lib/auth';
import { useLoadMessageSenders } from '@/hooks/useLoadMessageSenders';
import { useLoadReview } from '@/hooks/useLoadReview';
import ReviewModal from '@/components/reviews/ReviewModal';
import ImageViewerModal from '@/components/chat/ImageViewerModal';
import {
  LoadWithDetails,
  formatWeight,
  timeAgo,
  VEHICLE_LABELS,
} from '@/types/load';

const PRIMARY = '#FF6B35';
const GREEN = '#16A34A';

type Props = {
  load: LoadWithDetails;
  currentUserId: string;
};

function formatPhoneForDial(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }
  if (digits.startsWith('90') && digits.length >= 12) return `+${digits}`;
  if (digits.length === 10) return `+90${digits}`;
  return digits ? `+${digits}` : '';
}

export default function RoomLoadCard({ load, currentUserId }: Props) {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);

  const isOwner = currentUserId === load.user_id;
  const isAssigned = load.status === 'assigned';
  const canRate =
    ['assigned', 'in_transit', 'delivered'].includes(load.status) &&
    (isOwner ? load.assigned_to : true) &&
    (isOwner || currentUserId === load.assigned_to);
  const reviewedId = isOwner ? load.assigned_to : load.user_id;
  const reviewedName = isOwner ? load.assignedDriverName : load.ownerName;
  const { hasReviewed, refresh: refreshReview } = useLoadReview(
    expanded && canRate ? load.id : null,
    currentUserId,
    reviewedId || null
  );
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [fullScreenPhotoIndex, setFullScreenPhotoIndex] = useState<number | null>(null);
  const { senders, refresh } = useLoadMessageSenders(
    expanded && isOwner ? load.id : null,
    isOwner ? load.user_id : null,
  );

  const handleAssign = (driverId: string, driverName: string) => {
    Alert.alert(
      'İş Ver',
      `${driverName} kullanıcısına bu yükü atamak istediğinize emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Onayla', style: 'default', onPress: () => doAssign(driverId) },
      ],
    );
  };

  const doAssign = async (driverId: string) => {
    setAssigning(driverId);
    try {
      await supabase
        .from('loads')
        .update({ status: 'assigned', assigned_to: driverId })
        .eq('id', load.id);
    } catch (err: any) {
      Alert.alert('Hata', err.message || 'Bir hata oluştu.');
    } finally {
      setAssigning(null);
    }
  };

  const openChat = (
    otherUserId: string,
    otherName?: string,
    otherPhone?: string
  ) => {
    router.push({
      pathname: '/chat',
      params: {
        loadId: load.id,
        otherUserId,
        otherUserName: otherName || '',
        otherUserPhone: otherPhone || '',
        fromCity: load.from_city,
        fromDistrict: load.from_district,
        toCity: load.to_city,
        toDistrict: load.to_district,
      },
    });
  };

  const openCall = async (phone: string) => {
    const tel = formatPhoneForDial(phone);
    if (!tel) {
      Alert.alert('Hata', 'Telefon numarası bulunamadı.');
      return;
    }
    const url = `tel:${tel}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert('Bilgi', 'Bu cihazda arama yapılamıyor');
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Bilgi', 'Bu cihazda arama yapılamıyor');
    }
  };

  const handleAraPress = async () => {
    const targetUserId = isOwner && load.assigned_to ? load.assigned_to : load.user_id;
    let phone = isOwner && load.assigned_to ? load.assignedDriverPhone : load.ownerPhone;

    if (!phone && targetUserId) {
      const { data } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', targetUserId)
        .single();
      phone = data?.phone || '';
    }

    await openCall(phone || '');
  };

  const hasDimensions = load.width_cm || load.length_cm || load.height_cm;

  const otherPartyId = isOwner ? null : load.user_id;

  const hasCounterparty = ['assigned', 'in_transit', 'delivered'].includes(load.status) &&
    (isOwner ? load.assigned_to : currentUserId === load.assigned_to);
  const statusLabel =
    load.status === 'assigned'
      ? 'İŞ VERİLDİ'
      : load.status === 'in_transit'
        ? 'Yolda'
        : load.status === 'delivered'
          ? 'Teslim Edildi'
          : load.status === 'has_offers'
            ? 'Teklif Var'
            : 'Aktif';
  const isAssignedStatus = load.status === 'assigned';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.8}
    >
      {/* Row 1: Origin */}
      <View style={styles.routeRow}>
        <View style={[styles.dot, styles.dotOrigin]} />
        <Text style={styles.routeText}>
          {load.from_city} / {load.from_district || load.from_city}
        </Text>
      </View>

      {/* Row 2: Destination */}
      <View style={styles.routeRow}>
        <View style={[styles.dot, styles.dotDest]} />
        <Text style={styles.routeText}>
          {load.to_city} / {load.to_district || load.to_city}
        </Text>
      </View>

      {/* Row 3: Status badge (left), weight + time (right) */}
      <View style={styles.bottomRow}>
        <View style={styles.badgeTimeRow}>
          <View
            style={[
              styles.statusBadge,
              isAssignedStatus ? styles.statusBadgeAssigned : styles.statusBadgeDefault,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                isAssignedStatus && styles.statusBadgeTextAssigned,
              ]}
            >
              {statusLabel}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="package-variant" size={16} color="#6B7280" />
              <Text style={styles.metaText}>{formatWeight(load.weight_kg)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color="#6B7280" />
              <Text style={styles.metaText}>{timeAgo(load.created_at)}</Text>
            </View>
          </View>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#9CA3AF"
          style={styles.chevron}
        />
      </View>

      {expanded && (
        <View style={styles.details}>
          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>İlan Sahibi</Text>
            <View style={styles.detailValueRow}>
              <Text style={styles.detailValue}>{load.ownerName}</Text>
              {(load.ownerRatingAvg ?? 0) > 0 && (
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Ionicons
                      key={s}
                      name={(load.ownerRatingAvg ?? 0) >= s ? 'star' : 'star-outline'}
                      size={12}
                      color="#F59E0B"
                      style={styles.starIcon}
                    />
                  ))}
                </View>
              )}
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Araç Tipi</Text>
            <Text style={styles.detailValue}>
              {VEHICLE_LABELS[load.vehicle_type as keyof typeof VEHICLE_LABELS] ||
                load.vehicle_type}
            </Text>
          </View>

          {hasDimensions && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Boyut</Text>
              <Text style={styles.detailValue}>
                {[
                  load.width_cm && `${load.width_cm}`,
                  load.length_cm && `${load.length_cm}`,
                  load.height_cm && `${load.height_cm}`,
                ]
                  .filter(Boolean)
                  .join(' × ')}{' '}
                cm
              </Text>
            </View>
          )}

          {load.description && (
            <View style={styles.descriptionBox}>
              <Text style={styles.descriptionText}>{load.description}</Text>
            </View>
          )}

          {load.photos && load.photos.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.photosRow}
            >
              {load.photos.map((uri, i) => (
                <TouchableOpacity
                  key={`${uri}-${i}`}
                  onPress={() => setFullScreenPhotoIndex(i)}
                  activeOpacity={0.85}
                >
                  <Image source={{ uri }} style={styles.photo} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* --- Owner: list of message senders with İş Ver --- */}
          {isOwner && !isAssigned && senders.length > 0 && (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Mesaj Gönderenler</Text>
              {senders.map((s) => (
                <View key={s.id} style={styles.senderRow}>
                  <View style={styles.senderInfo}>
                    <Text style={styles.senderName}>{s.name}</Text>
                  </View>
                  <View style={styles.senderActions}>
                    <TouchableOpacity
                      style={styles.msgBtn}
                      onPress={() => openChat(s.userId, s.name, s.phone)}
                    >
                      <Ionicons name="chatbubble-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.msgBtnText}>Mesaj</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.callBtn}
                      onPress={() => openCall(s.phone)}
                    >
                      <Ionicons name="call" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
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
                  </View>
                </View>
              ))}
            </>
          )}

          {/* --- Non-owner: Mesaj Gönder + Ara buttons --- */}
          {!isAssigned && !isOwner && (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.mesajButton}
                onPress={() =>
                  otherPartyId &&
                  openChat(otherPartyId, load.ownerName, load.ownerPhone)
                }
                activeOpacity={0.8}
              >
                <Ionicons name="chatbubble" size={20} color="#FFFFFF" />
                <Text style={styles.mesajButtonText}>Mesaj Gönder</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.araButton}
                onPress={handleAraPress}
                activeOpacity={0.8}
              >
                <Ionicons name="call" size={22} color="#FFFFFF" />
                <Text style={styles.araButtonText}>Ara</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* --- Owner with no message senders yet --- */}
          {isOwner && !isAssigned && senders.length === 0 && (
            <Text style={styles.emptySenders}>
              Henüz mesaj yok. Sürücüler size mesaj gönderdiğinde burada listelenecek.
            </Text>
          )}

          {/* --- Assigned, in_transit, delivered: Mesaj + Ara (owner→driver, driver→owner) --- */}
          {hasCounterparty && (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.mesajButton}
                onPress={() =>
                  openChat(
                    isOwner && load.assigned_to ? load.assigned_to : load.user_id,
                    isOwner ? load.assignedDriverName : load.ownerName,
                    isOwner ? load.assignedDriverPhone : load.ownerPhone
                  )
                }
                activeOpacity={0.8}
              >
                <Ionicons name="chatbubble" size={20} color="#FFFFFF" />
                <Text style={styles.mesajButtonText}>Mesaj Gönder</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.araButton}
                onPress={handleAraPress}
                activeOpacity={0.8}
              >
                <Ionicons name="call" size={22} color="#FFFFFF" />
                <Text style={styles.araButtonText}>Ara</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* --- Puanla / Puanlandı: both owner and driver can rate the other party (one review per user per load) --- */}
          {canRate && reviewedId && (
            <>
              <View style={styles.divider} />
              {hasReviewed ? (
                <View style={styles.puanlandiBadge}>
                  <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                  <Text style={styles.puanlandiText}>Puanlandı ✓</Text>
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.puanlaButton}
                    onPress={() => setShowReviewModal(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="star" size={20} color="#FFFFFF" />
                    <Text style={styles.puanlaButtonText}>
                      {(reviewedName || 'Kullanıcı')} puanla
                    </Text>
                  </TouchableOpacity>
                  <ReviewModal
                    visible={showReviewModal}
                    onClose={() => setShowReviewModal(false)}
                    onSuccess={() => {
                      refreshReview();
                      refreshProfile();
                    }}
                    loadId={load.id}
                    reviewedId={reviewedId}
                    reviewedName={reviewedName || 'Kullanıcı'}
                  />
                </>
              )}
            </>
          )}
        </View>
      )}
      <ImageViewerModal
        visible={fullScreenPhotoIndex !== null}
        images={load.photos ?? []}
        initialIndex={fullScreenPhotoIndex ?? 0}
        onClose={() => setFullScreenPhotoIndex(null)}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
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
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
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
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  badgeTimeRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 0,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeDefault: {
    backgroundColor: '#E5E7EB',
  },
  statusBadgeAssigned: {
    backgroundColor: '#DC2626',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  statusBadgeTextAssigned: {
    color: '#FFFFFF',
  },
  chevron: {
    flexShrink: 0,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 12,
    flexShrink: 0,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#6B7280',
  },
  details: {
    marginTop: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    marginVertical: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  detailValueRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  starIcon: {
    marginLeft: 0,
  },
  descriptionBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  photosRow: {
    marginTop: 8,
    marginBottom: 4,
  },
  photo: {
    width: 72,
    height: 72,
    borderRadius: 10,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 10,
  },
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  senderInfo: {
    flex: 1,
  },
  senderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  senderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  msgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  msgBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
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
  assignBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  actionRow: {
    marginTop: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  mesajButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mesajButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  araButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GREEN,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6,
  },
  araButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  emptySenders: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  puanlaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  puanlaButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  puanlandiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  puanlandiText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#16A34A',
  },
});
