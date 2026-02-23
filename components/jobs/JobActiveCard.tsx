import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import { LoadWithDetails, formatWeight } from '@/types/load';

const PRIMARY = '#2563EB';
const GREEN = '#16A34A';

type Props = {
  load: LoadWithDetails;
  currentUserId: string;
  onComplete?: () => void | Promise<void>;
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

export default function JobActiveCard({ load, currentUserId, onComplete }: Props) {
  const router = useRouter();
  const [completing, setCompleting] = useState(false);

  const isOwner = currentUserId === load.user_id;
  const isDriver = currentUserId === load.assigned_to;
  const otherUserId = isOwner ? load.assigned_to : load.user_id;
  const otherName = isOwner ? load.assignedDriverName : load.ownerName;
  const otherPhone = isOwner ? load.assignedDriverPhone : load.ownerPhone;

  const openChat = () => {
    if (!otherUserId) return;
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

  const handleAraPress = async () => {
    let phone = otherPhone;

    if (!phone && otherUserId) {
      const { data } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', otherUserId)
        .single();
      phone = data?.phone || '';
    }

    if (otherUserId && load.id) {
      const payload = {
        sender_id: currentUserId,
        receiver_id: otherUserId,
        load_id: load.id,
        content: '📞 Arama yapıldı',
        message_type: 'call_attempt',
      };
      const { data: insertData, error: insertError } = await supabase
        .from('messages')
        .insert(payload)
        .select('id, sender_id, receiver_id, load_id, message_type, created_at')
        .single();
      console.log('[JobActiveCard] call_attempt insert', {
        payload,
        ok: !insertError,
        data: insertData,
        error: insertError?.message ?? null,
      });
    }

    const tel = formatPhoneForDial(phone || '');
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

  const handleTamamlandi = () => {
    Alert.alert(
      'Teslim Onayı',
      'Bu yükü teslim ettiğinizi onaylıyor musunuz?',
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Onayla', style: 'default', onPress: doMarkCompleted },
      ]
    );
  };

  const doMarkCompleted = async () => {
    setCompleting(true);
    try {
      const { error } = await supabase
        .from('loads')
        .update({ status: 'delivered' })
        .eq('id', load.id)
        .eq('assigned_to', currentUserId);

      if (error) {
        Alert.alert('Hata', error.message || 'İşlem başarısız oldu.');
        return;
      }
      await onComplete?.();
    } catch (err: unknown) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Bir hata oluştu.');
    } finally {
      setCompleting(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.routeRow}>
        <View style={[styles.dot, styles.dotOrigin]} />
        <Text style={styles.routeText}>
          {load.from_city} / {load.from_district || load.from_city}
        </Text>
      </View>

      <View style={styles.routeRow}>
        <View style={[styles.dot, styles.dotDest]} />
        <Text style={styles.routeText}>
          {load.to_city} / {load.to_district || load.to_city}
        </Text>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <MaterialCommunityIcons name="package-variant" size={16} color="#6B7280" />
          <Text style={styles.metaText}>{formatWeight(load.weight_kg)}</Text>
        </View>
      </View>

      <View style={styles.partyRow}>
        <Text style={styles.partyLabel}>Karşı Taraf:</Text>
        <Text style={styles.partyName}>{otherName || 'Bilinmiyor'}</Text>
        {otherPhone ? (
          <Text style={styles.partyPhone}>{otherPhone}</Text>
        ) : null}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.mesajButton}
          onPress={openChat}
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

      {/* Driver (assigned_to): only they can mark delivered */}
      {currentUserId === load.assigned_to && (
        <TouchableOpacity
          style={styles.tamamlandiButton}
          onPress={handleTamamlandi}
          disabled={completing}
          activeOpacity={0.8}
        >
          {completing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
              <Text style={styles.tamamlandiButtonText}>Tamamlandı</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Owner (user_id): waits for delivery */}
      {currentUserId === load.user_id && (
        <View style={styles.statusTextRow}>
          <Ionicons name="time-outline" size={18} color="#6B7280" />
          <Text style={styles.statusText}>Teslim bekleniyor...</Text>
        </View>
      )}
    </View>
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
  metaRow: {
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 12,
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
  partyRow: {
    marginBottom: 14,
  },
  partyLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  partyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  partyPhone: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
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
  tamamlandiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GREEN,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
  },
  tamamlandiButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  statusTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 12,
  },
  statusText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
});
