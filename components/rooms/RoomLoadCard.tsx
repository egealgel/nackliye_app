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
import RouteDisplay from '@/components/RouteDisplay';
import { useLoadMessageSenders } from '@/hooks/useLoadMessageSenders';
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
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('90') && digits.length >= 12) return `+${digits}`;
  if (digits.length === 10) return `+90${digits}`;
  return digits ? `+${digits}` : '';
}

export default function RoomLoadCard({ load, currentUserId }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);

  const isOwner = currentUserId === load.user_id;
  const isAssigned = load.status === 'assigned';
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

  const openChat = (otherUserId: string) => {
    router.push({
      pathname: '/chat',
      params: {
        loadId: load.id,
        otherUserId,
        fromCity: load.from_city,
        fromDistrict: load.from_district,
        toCity: load.to_city,
        toDistrict: load.to_district,
      },
    });
  };

  const openCall = (phone: string) => {
    const tel = formatPhoneForDial(phone);
    if (tel) Linking.openURL(`tel:${tel}`);
    else Alert.alert('Hata', 'Telefon numarası bulunamadı.');
  };

  const hasDimensions = load.width_cm || load.length_cm || load.height_cm;

  const otherPartyId = isOwner ? null : load.user_id;
  const otherPartyPhone = isOwner ? '' : load.ownerPhone;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.8}
    >
      <View style={styles.topRow}>
        <View style={styles.routeWrap}>
          <RouteDisplay
            fromCity={load.from_city}
            fromDistrict={load.from_district}
            toCity={load.to_city}
            toDistrict={load.to_district}
          />
        </View>
        {isAssigned && (
          <View style={styles.assignedBadge}>
            <Text style={styles.assignedBadgeText}>
              İŞ VERİLDİ{load.assignedDriverName ? ` – ${load.assignedDriverName}` : ''}
            </Text>
          </View>
        )}
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#9CA3AF"
          style={styles.chevron}
        />
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

      {expanded && (
        <View style={styles.details}>
          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>İlan Sahibi</Text>
            <Text style={styles.detailValue}>{load.ownerName}</Text>
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
                <Image key={`${uri}-${i}`} source={{ uri }} style={styles.photo} />
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
                      onPress={() => openChat(s.userId)}
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
                onPress={() => otherPartyId && openChat(otherPartyId)}
                activeOpacity={0.8}
              >
                <Ionicons name="chatbubble" size={20} color="#FFFFFF" />
                <Text style={styles.mesajButtonText}>Mesaj Gönder</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.araButton}
                onPress={() => openCall(otherPartyPhone)}
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

          {/* --- Assigned or non-owner: Mesaj + Ara (owner→driver, non-owner→owner) --- */}
          {isAssigned && (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.mesajButton}
                onPress={() =>
                  openChat(isOwner && load.assigned_to ? load.assigned_to : load.user_id)
                }
                activeOpacity={0.8}
              >
                <Ionicons name="chatbubble" size={20} color="#FFFFFF" />
                <Text style={styles.mesajButtonText}>Mesaj Gönder</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.araButton}
                onPress={() => {
                  const phone = isOwner ? load.assignedDriverPhone : load.ownerPhone;
                  if (phone) openCall(phone);
                  else Alert.alert('Bilgi', 'Telefon numarası bulunamadı.');
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="call" size={22} color="#FFFFFF" />
                <Text style={styles.araButtonText}>Ara</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  routeWrap: {
    flex: 1,
    minWidth: 0,
  },
  assignedBadge: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexShrink: 0,
  },
  assignedBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  chevron: {
    marginTop: 2,
    flexShrink: 0,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
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
});
