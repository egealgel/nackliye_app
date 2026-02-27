import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/lib/auth';
import { useLoadReview } from '@/hooks/useLoadReview';
import ReviewModal from '@/components/reviews/ReviewModal';
import ImageViewerModal from '@/components/chat/ImageViewerModal';
import {
  LoadWithDetails,
  formatWeight,
  timeAgo,
  VEHICLE_LABELS,
  isBosAracLoad,
} from '@/types/load';

const PRIMARY = '#2563EB';
const GREEN = '#16A34A';

type Props = {
  load: LoadWithDetails;
  currentUserId: string;
  onDelete?: (loadId: string) => void;
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

export default function RoomLoadCard({ load, currentUserId, onDelete }: Props) {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [expanded, setExpanded] = useState(false);

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

    if (targetUserId && load.id) {
      const payload = {
        sender_id: currentUserId,
        receiver_id: targetUserId,
        load_id: load.id,
        content: '📞 Arama yapıldı',
        message_type: 'call_attempt',
      };
      const { data: insertData, error: insertError } = await supabase
        .from('messages')
        .insert(payload)
        .select('id, sender_id, receiver_id, load_id, message_type, created_at')
        .single();
      console.log('[RoomLoadCard] call_attempt insert', {
        payload,
        ok: !insertError,
        data: insertData,
        error: insertError?.message ?? null,
      });
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

  const isBosArac = isBosAracLoad(load);

  return (
    <TouchableOpacity
      style={[styles.card, isBosArac && styles.bosAracCard]}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.8}
    >
      {isBosArac ? (
        <>
          <Text style={styles.bosAracDescription} numberOfLines={2}>
            {load.description || 'Boş araç ilanı'}
          </Text>
          <View style={styles.bosAracMetaRow}>
            <View
              style={[
                styles.statusBadge,
                isAssignedStatus
                  ? styles.statusBadgeAssigned
                  : load.status === 'active'
                    ? styles.statusBadgeActive
                    : styles.statusBadgeDefault,
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  isAssignedStatus && styles.statusBadgeTextAssigned,
                  load.status === 'active' && styles.statusBadgeTextActive,
                ]}
              >
                {statusLabel}
              </Text>
            </View>
            <View style={styles.bosAracTimeRow}>
              <Ionicons name="time-outline" size={14} color="#6B7280" />
              <Text style={styles.bosAracTimeText}>{timeAgo(load.created_at)}</Text>
            </View>
            <View style={styles.bosAracOwnerRow}>
              <Text style={styles.bosAracOwnerName}>{load.ownerName}</Text>
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
          <View style={styles.bosAracChevronRow}>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#9CA3AF"
            />
          </View>
        </>
      ) : (
        <>
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

      {/* Row 3: [Status] · weight · vehicle type (tags) + chevron */}
      <View style={styles.tagsRow}>
        <View style={styles.tagsLine}>
          <View
            style={[
              styles.statusBadge,
              isAssignedStatus
                ? styles.statusBadgeAssigned
                : load.status === 'active'
                  ? styles.statusBadgeActive
                  : styles.statusBadgeDefault,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                isAssignedStatus && styles.statusBadgeTextAssigned,
                load.status === 'active' && styles.statusBadgeTextActive,
              ]}
            >
              {statusLabel}
            </Text>
          </View>
          <Text style={styles.tagDot}>·</Text>
          <Text style={styles.tagText}>{formatWeight(load.weight_kg)}</Text>
          <Text style={styles.tagDot}>·</Text>
          <Text style={styles.tagText}>
            {VEHICLE_LABELS[load.vehicle_type as keyof typeof VEHICLE_LABELS] ||
              load.vehicle_type}
          </Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#9CA3AF"
          style={styles.chevron}
        />
      </View>
        </>
      )}

      {expanded && (
        <View style={[styles.details, isBosArac && styles.bosAracDetails]}>
          <View style={[styles.divider, isBosArac && styles.bosAracDivider]} />

          {isBosArac ? (
            <>
              {isOwner && ['active', 'has_offers'].includes(load.status) && (
                <View style={[styles.ownerActions, styles.bosAracOwnerActions]}>
                  <TouchableOpacity
                    style={[styles.ownerActionBtn, styles.ownerActionBtnDanger]}
                    onPress={() =>
                      Alert.alert(
                        'İlanı Sil',
                        'Bu ilanı silmek istediğinize emin misiniz?',
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
                              onDelete?.(load.id);
                              router.back();
                            },
                          },
                        ],
                      )
                    }
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={18} color="#DC2626" />
                    <Text style={[styles.ownerActionText, { color: '#DC2626' }]}>Sil</Text>
                  </TouchableOpacity>
                </View>
              )}
              {!isOwner && (
              <View style={[styles.contactLine, styles.bosAracContactLine]}>
                <Text style={styles.contactName}>{load.ownerName}</Text>
                {(load.ownerRatingAvg ?? 0) > 0 && (
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Ionicons
                        key={s}
                        name={(load.ownerRatingAvg ?? 0) >= s ? 'star' : 'star-outline'}
                        size={14}
                        color="#F59E0B"
                        style={styles.starIcon}
                      />
                    ))}
                  </View>
                )}
              </View>
              )}
              {!isOwner && (
                <View style={[styles.buttonRow, styles.bosAracButtonRow]}>
                  <TouchableOpacity
                    style={styles.mesajButton}
                    onPress={() =>
                      openChat(load.user_id, load.ownerName, load.ownerPhone)
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
            </>
          ) : (
            <>
          {isOwner && ['active', 'has_offers'].includes(load.status) && (
            <View style={styles.ownerActions}>
              <TouchableOpacity
                style={styles.ownerActionBtn}
                onPress={() =>
                  router.push({
                    pathname: '/edit-load',
                    params: { loadId: load.id },
                  })
                }
                activeOpacity={0.7}
              >
                <Ionicons name="create-outline" size={18} color={PRIMARY} />
                <Text style={styles.ownerActionText}>Düzenle</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.ownerActionBtn, styles.ownerActionBtnDanger]}
                onPress={() =>
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
                            Alert.alert(
                              'Hata',
                              error.message || 'Silme işlemi başarısız.',
                            );
                            return;
                          }
                          onDelete?.(load.id);
                          router.back();
                        },
                      },
                    ],
                  )
                }
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={18} color="#DC2626" />
                <Text style={[styles.ownerActionText, { color: '#DC2626' }]}>
                  Sil
                </Text>
              </TouchableOpacity>
            </View>
          )}

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

          {/* --- Owner: İş Verildi badge when assigned (assign from İşlerim > Paylaştığım İşler) --- */}
          {isOwner && isAssigned && load.assignedDriverName && (
            <>
              <View style={styles.divider} />
              <View style={styles.assignedBadgeRow}>
                <Ionicons name="checkmark-circle" size={22} color={GREEN} />
                <Text style={styles.assignedBadgeText}>
                  İş Verildi — {load.assignedDriverName}
                </Text>
              </View>
            </>
          )}

          {/* --- Contact: owner name + stars (above action buttons) --- */}
          {(!isAssigned && !isOwner) || hasCounterparty ? (
            <View style={styles.contactLine}>
              <Text style={styles.contactName}>
                {!isAssigned && !isOwner
                  ? load.ownerName
                  : isOwner
                    ? load.assignedDriverName
                    : load.ownerName}
              </Text>
              {((!isAssigned && !isOwner && (load.ownerRatingAvg ?? 0) > 0) ||
                (hasCounterparty && isOwner && (load.assignedDriverRatingAvg ?? 0) > 0) ||
                (hasCounterparty && !isOwner && (load.ownerRatingAvg ?? 0) > 0)) && (
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((s) => {
                    const avg =
                      !isAssigned && !isOwner
                        ? load.ownerRatingAvg ?? 0
                        : isOwner
                          ? load.assignedDriverRatingAvg ?? 0
                          : load.ownerRatingAvg ?? 0;
                    return (
                      <Ionicons
                        key={s}
                        name={avg >= s ? 'star' : 'star-outline'}
                        size={14}
                        color="#F59E0B"
                        style={styles.starIcon}
                      />
                    );
                  })}
                </View>
              )}
            </View>
          ) : null}

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
  bosAracCard: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  bosAracDescription: {
    fontSize: 15,
    color: '#1F2937',
    lineHeight: 22,
    marginBottom: 5,
  },
  bosAracMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 5,
  },
  bosAracTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bosAracTimeText: {
    fontSize: 13,
    color: '#6B7280',
  },
  bosAracOwnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  bosAracOwnerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  bosAracChevronRow: {
    alignItems: 'flex-end',
    marginTop: 4,
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
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  tagsLine: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    minWidth: 0,
  },
  tagDot: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  tagText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeDefault: {
    backgroundColor: '#E5E7EB',
  },
  statusBadgeActive: {
    backgroundColor: '#E6F9E6',
  },
  statusBadgeAssigned: {
    backgroundColor: '#2563EB',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  statusBadgeTextActive: {
    color: '#22C55E',
  },
  statusBadgeTextAssigned: {
    color: '#FFFFFF',
  },
  chevron: {
    flexShrink: 0,
  },
  details: {
    marginTop: 4,
  },
  bosAracDetails: {
    marginTop: 2,
  },
  ownerActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  bosAracOwnerActions: {
    marginBottom: 5,
  },
  ownerActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
  },
  ownerActionBtnDanger: {
    backgroundColor: '#FEF2F2',
  },
  ownerActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    marginVertical: 14,
  },
  bosAracDivider: {
    marginVertical: 5,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 12,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  contactLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  bosAracContactLine: {
    marginBottom: 5,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
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
  senderNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  senderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  senderIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  senderIcon: {
    marginLeft: 0,
  },
  senderVehicle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
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
  bosAracButtonRow: {
    marginTop: 5,
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

  bigAssignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GREEN,
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
  },
  bigAssignBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  bigAssignBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  bigAssignBadgeText: {
    color: GREEN,
    fontSize: 13,
    fontWeight: '800',
  },

  assignedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
  },
  assignedBadgeText: {
    fontSize: 16,
    fontWeight: '700',
    color: GREEN,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 34,
    maxHeight: '70%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 16,
  },
  modalList: {
    flexGrow: 0,
  },
  modalSenderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  modalSenderInfo: {
    flex: 1,
    marginRight: 12,
  },
  modalSenderNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalSenderName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
  },
  modalSenderIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modalSenderVehicle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  modalAssignBtn: {
    backgroundColor: GREEN,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 80,
    alignItems: 'center',
  },
  modalAssignBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  modalEmpty: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  modalEmptyText: {
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  modalCloseBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  modalCloseBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
});
