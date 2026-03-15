import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Linking,
  Image,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import ImageViewerModal from '@/components/chat/ImageViewerModal';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { useUnreadCount } from '@/lib/UnreadCountContext';
import { supabase } from '@/services/supabase';
import LoadSummaryCard from '@/components/chat/LoadSummaryCard';
import { pickAndUploadPhoto, pickAndUploadDocument, type DocumentMeta } from '@/utils/chatMedia';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestNotificationsAfterFirstAction } from '@/services/notifications';

const CHAT_BANNER_DISMISSED_KEY = 'chat_security_banner_dismissed';

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  media_url: string | null;
  message_type: 'text' | 'image' | 'document' | 'system' | 'call_attempt';
  read_at: string | null;
  created_at: string;
};

type LoadInfo = {
  weight_kg: number;
  status: string;
  from_city: string | null;
  from_district: string | null;
  to_city: string | null;
  to_district: string | null;
  vehicle_type: string | null;
  description: string | null;
};

type ListItem =
  | { type: 'day'; date: string; key: string }
  | { type: 'message'; message: Message; key: string };

function formatPhoneForDial(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('90') && digits.length >= 12) return `+${digits}`;
  if (digits.length === 10) return `+90${digits}`;
  return digits ? `+${digits}` : '';
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Bugün';
  if (d.toDateString() === yesterday.toDateString()) return 'Dün';
  return d.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

function buildListItems(messages: Message[]): ListItem[] {
  const items: ListItem[] = [];
  let lastDay = '';

  for (const m of messages) {
    const day = m.created_at.slice(0, 10);
    if (day !== lastDay) {
      lastDay = day;
      items.push({ type: 'day', date: m.created_at, key: `day-${day}` });
    }
    items.push({ type: 'message', message: m, key: m.id });
  }
  return items;
}

export default function ChatScreen() {
  const {
    loadId,
    otherUserId,
    otherUserName,
    otherUserPhone,
  } = useLocalSearchParams<{
    loadId: string;
    otherUserId: string;
    otherUserName?: string;
    otherUserPhone?: string;
  }>();

  const router = useRouter();
  const { session, profile } = useAuth();
  const { refresh: refreshUnread } = useUnreadCount();
  const currentUserId = session?.user?.id || '';
  const flatListRef = useRef<FlatList>(null);
  const prevMessagesLength = useRef(0);
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loadInfo, setLoadInfo] = useState<LoadInfo | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState(otherUserName || 'Kullanıcı');
  const [displayPhone, setDisplayPhone] = useState(otherUserPhone || '');
  const [bannerDismissed, setBannerDismissed] = useState<boolean | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [fullScreenImageUri, setFullScreenImageUri] = useState<string | null>(null);

  const fetchLoadInfo = useCallback(async () => {
    if (!loadId) return;
    const { data } = await supabase
      .from('loads')
      .select('weight_kg, status, from_city, from_district, to_city, to_district, vehicle_type, description')
      .eq('id', loadId)
      .single();
    if (data) setLoadInfo(data);
  }, [loadId]);

  const fetchOtherProfile = useCallback(async () => {
    if (!otherUserId) return;
    const { data } = await supabase
      .from('profiles')
      .select('name, phone')
      .eq('id', otherUserId)
      .single();
    if (data?.name) setDisplayName(data.name);
    if (data?.phone && !otherUserPhone) setDisplayPhone(data.phone);
  }, [otherUserId, otherUserName, otherUserPhone]);

  const markAsRead = useCallback(async () => {
    if (!loadId || !currentUserId) return;
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('load_id', loadId)
      .eq('receiver_id', currentUserId)
      .is('read_at', null);
    await refreshUnread();
  }, [loadId, currentUserId, refreshUnread]);

  const fetchMessages = useCallback(async () => {
    if (!loadId || !otherUserId || !currentUserId) return;

    const { data } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, media_url, message_type, read_at, created_at')
      .eq('load_id', loadId)
      .order('created_at', { ascending: true });

    const betweenUs = (data || []).filter(
      (m) =>
        (m.sender_id === currentUserId && m.receiver_id === otherUserId) ||
        (m.sender_id === otherUserId && m.receiver_id === currentUserId)
    );
    setMessages(betweenUs);
    setLoading(false);
  }, [loadId, otherUserId, currentUserId]);

  useFocusEffect(
    useCallback(() => {
      if (otherUserName) setDisplayName(otherUserName);
      if (otherUserPhone) setDisplayPhone(otherUserPhone);
      fetchOtherProfile();
    }, [otherUserName, otherUserPhone, fetchOtherProfile])
  );

  useEffect(() => {
    AsyncStorage.getItem(CHAT_BANNER_DISMISSED_KEY).then((v) => {
      setBannerDismissed(v === 'true');
    });
  }, []);

  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
    AsyncStorage.setItem(CHAT_BANNER_DISMISSED_KEY, 'true');
  }, []);

  const formatPhoneDisplay = (phone: string): string => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) return phone;
    const d = digits.startsWith('90') ? digits.slice(2) : digits;
    if (d.length === 10) return `+90 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
    return `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  };

  useEffect(() => {
    fetchLoadInfo();
  }, [fetchLoadInfo]);

  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel(`chat-${loadId}-${otherUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `load_id=eq.${loadId}`,
        },
        () => fetchMessages()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadId, otherUserId, fetchMessages]);

  useEffect(() => {
    if (messages.length > prevMessagesLength.current && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
    prevMessagesLength.current = messages.length;
  }, [messages.length]);

  useFocusEffect(
    useCallback(() => {
      markAsRead();
    }, [markAsRead])
  );

  useEffect(() => {
    markAsRead();
  }, [markAsRead]);

  const senderName = profile?.name ?? 'Biri';

  const sendPushNotification = async (
    receiverId: string,
    messagePreview: string
  ) => {
    try {
      await supabase.functions.invoke('send-notification', {
        body: {
          user_id: receiverId,
          title: 'Yeni Mesaj',
          body: `${senderName}: ${messagePreview}`,
          data: {
            type: 'chat',
            loadId,
            otherUserId: currentUserId,
            otherUserName: senderName,
          },
        },
      });
    } catch {
      // Silent fail for push
    }
  };

  const sendTextMessage = async () => {
    const text = input.trim();
    if (!text || !loadId || !otherUserId || !currentUserId) return;

    setInput('');
    const { error } = await supabase.from('messages').insert({
      sender_id: currentUserId,
      receiver_id: otherUserId,
      load_id: loadId,
      content: text,
      message_type: 'text',
    });
    if (!error) {
      const preview = text.length > 50 ? text.slice(0, 50) + '…' : text;
      await sendPushNotification(otherUserId, preview);
      requestNotificationsAfterFirstAction(currentUserId);
    }
  };

  const sendPhotoMessage = async (mediaUrl: string) => {
    if (!loadId || !otherUserId || !currentUserId) return;

    const { error } = await supabase.from('messages').insert({
      sender_id: currentUserId,
      receiver_id: otherUserId,
      load_id: loadId,
      content: '',
      message_type: 'image',
      media_url: mediaUrl,
    });
    if (!error) {
      await sendPushNotification(otherUserId, '📷 Fotoğraf');
      requestNotificationsAfterFirstAction(currentUserId);
    }
  };

  const sendDocumentMessage = async (mediaUrl: string, meta: DocumentMeta) => {
    if (!loadId || !otherUserId || !currentUserId) return;

    const { error } = await supabase.from('messages').insert({
      sender_id: currentUserId,
      receiver_id: otherUserId,
      load_id: loadId,
      content: JSON.stringify(meta),
      message_type: 'document',
      media_url: mediaUrl,
    });
    if (!error) {
      await sendPushNotification(otherUserId, '📄 Belge');
      requestNotificationsAfterFirstAction(currentUserId);
    }
  };

  const handlePickPhoto = async (mode: 'camera' | 'gallery') => {
    if (!currentUserId) return;
    setUploadingPhoto(true);
    try {
      const url = await pickAndUploadPhoto(currentUserId, mode);
      if (url) await sendPhotoMessage(url);
    } catch (err: any) {
      Alert.alert('Hata', err.message || 'Fotoğraf yüklenemedi.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePickDocument = async () => {
    if (!currentUserId) return;
    setUploadingDoc(true);
    try {
      const result = await pickAndUploadDocument(currentUserId);
      if (result) await sendDocumentMessage(result.url, result.meta);
    } catch (err: any) {
      Alert.alert('Hata', err.message || 'Dosya yüklenemedi.');
    } finally {
      setUploadingDoc(false);
    }
  };

  const openCall = async () => {
    const phone = otherUserPhone || '';
    const tel = formatPhoneForDial(phone);
    if (!tel) {
      Alert.alert('Bilgi', 'Telefon numarası bulunamadı.');
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

  const listItems = buildListItems(messages);

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'day') {
      return (
        <View style={styles.dayRow}>
          <Text style={styles.dayText}>{formatDayLabel(item.date)}</Text>
        </View>
      );
    }

    const m = item.message;

    if (m.message_type === 'system') {
      return (
        <View style={styles.systemRow}>
          <Text style={styles.systemText}>{m.content}</Text>
        </View>
      );
    }
    if (m.message_type === 'call_attempt') {
      return (
        <View style={styles.systemRow}>
          <Text style={styles.callAttemptText}>{m.content}</Text>
        </View>
      );
    }

    const isMe = m.sender_id === currentUserId;
    const isDocument = m.message_type === 'document';

    let docMeta: DocumentMeta | null = null;
    if (isDocument && m.content) {
      try {
        docMeta = JSON.parse(m.content) as DocumentMeta;
      } catch {
        docMeta = { fileName: 'Dosya', fileSize: 0 };
      }
    }

    const truncateFileName = (name: string, maxLen: number = 24) =>
      name.length > maxLen ? name.slice(0, maxLen - 3) + '...' : name;

    const formatFileSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const timeLabel = new Date(m.created_at).toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    return (
      <View style={[styles.bubbleWrap, isMe && styles.bubbleWrapMe]}>
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          {isDocument && m.media_url && docMeta ? (
            <View style={styles.docCard}>
              <Ionicons name="document-outline" size={32} color={isMe ? '#FFFFFF' : '#6B7280'} />
              <View style={styles.docCardInfo}>
                <Text style={[styles.docCardName, isMe && styles.docCardNameMe]} numberOfLines={1}>
                  {truncateFileName(docMeta.fileName, 28)}
                </Text>
                <Text style={[styles.docCardSize, isMe && styles.docCardSizeMe]}>
                  {formatFileSize(docMeta.fileSize)}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.docDownloadBtn, isMe && styles.docDownloadBtnMe]}
                onPress={() => Linking.openURL(m.media_url!)}
                activeOpacity={0.8}
              >
                <Text style={[styles.docDownloadText, isMe && styles.docDownloadTextMe]}>Aç</Text>
              </TouchableOpacity>
            </View>
          ) : m.media_url && m.message_type === 'image' ? (
            <TouchableOpacity
              onPress={() => setFullScreenImageUri(m.media_url)}
              activeOpacity={1}
            >
              <Image source={{ uri: m.media_url }} style={styles.bubbleImage} resizeMode="cover" />
            </TouchableOpacity>
          ) : null}
          {!isDocument && m.content ? (
            <Text
              style={[
                styles.bubbleText,
                isMe && styles.bubbleTextMe,
                styles.bubbleTextWithMeta,
              ]}
            >
              {m.content}
            </Text>
          ) : null}
          <View style={styles.bubbleFooter}>
            <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>
              {timeLabel}
            </Text>
            {isMe && (
              <View style={styles.checkmarksWrapper}>
                <Text
                  style={[
                    styles.checkmark,
                    m.read_at ? styles.checkmarkRead : styles.checkmarkUnread,
                  ]}
                >
                  ✓
                </Text>
                <Text
                  style={[
                    styles.checkmark,
                    m.read_at ? styles.checkmarkRead : styles.checkmarkUnread,
                    styles.checkmarkSecond,
                  ]}
                >
                  ✓
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const listHeader = loadInfo ? (
    <LoadSummaryCard
      fromCity={loadInfo.from_city || ''}
      fromDistrict={loadInfo.from_district || ''}
      toCity={loadInfo.to_city || ''}
      toDistrict={loadInfo.to_district || ''}
      weightKg={loadInfo.weight_kg}
      status={loadInfo.status}
      description={loadInfo.description}
      vehicleType={loadInfo.vehicle_type}
    />
  ) : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <SafeAreaView style={styles.safe} edges={['top']}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {displayName}
          </Text>
          {displayPhone ? (
            <Text style={styles.headerPhone} numberOfLines={1}>
              {formatPhoneDisplay(displayPhone)}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity onPress={openCall} style={styles.callBtn}>
          <Ionicons name="call" size={22} color="#2563EB" />
        </TouchableOpacity>
      </View>

      {bannerDismissed === false && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Tüm konuşmalarınız güvenle kayıt altındadır. Uygulama içinden yazışmanız tavsiye edilir.
          </Text>
          <TouchableOpacity
            onPress={dismissBanner}
            style={styles.bannerClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={18} color="#6B7280" />
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      ) : messages.length === 0 ? (
        <>
          {listHeader}
          <View style={styles.center}>
            <Text style={styles.emptyText}>
              Henüz mesaj yok.{'\n'}Merhaba yazarak sohbeti başlatın.
            </Text>
          </View>
        </>
      ) : (
        <FlatList
          ref={flatListRef}
          data={listItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.list}
          ListHeaderComponent={listHeader}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
        />
      )}

        <View
          style={[
            styles.inputRow,
            Platform.OS === 'android' && {
              paddingBottom: 8 + (insets.bottom || 16),
            },
          ]}
        >
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => handlePickPhoto('camera')}
            disabled={uploadingPhoto}
          >
            {uploadingPhoto ? (
              <ActivityIndicator size="small" color="#6B7280" />
            ) : (
              <Ionicons name="camera-outline" size={24} color="#6B7280" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => handlePickPhoto('gallery')}
            disabled={uploadingPhoto}
          >
            <Ionicons name="images-outline" size={24} color="#6B7280" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={handlePickDocument}
            disabled={uploadingDoc}
          >
            {uploadingDoc ? (
              <ActivityIndicator size="small" color="#6B7280" />
            ) : (
              <Ionicons name="attach-outline" size={24} color="#6B7280" />
            )}
          </TouchableOpacity>
          <View style={styles.inputWrap}>
            <Ionicons name="shield-checkmark-outline" size={16} color="#9CA3AF" style={styles.inputShield} />
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Mesaj yazın..."
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={500}
            />
          </View>
          <TouchableOpacity
            style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
            onPress={sendTextMessage}
            disabled={!input.trim()}
          >
            <Ionicons
              name="send"
              size={20}
              color={input.trim() ? '#FFFFFF' : '#9CA3AF'}
            />
          </TouchableOpacity>
        </View>

      <ImageViewerModal
        visible={!!fullScreenImageUri}
        imageUri={fullScreenImageUri}
        onClose={() => setFullScreenImageUri(null)}
      />
      </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: {
    marginRight: 8,
  },
  headerCenter: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerPhone: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingRight: 36,
  },
  bannerText: {
    flex: 1,
    fontSize: 12,
    color: '#1E40AF',
    lineHeight: 16,
  },
  bannerClose: {
    position: 'absolute',
    right: 10,
    top: 10,
    padding: 4,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxHeight: 100,
  },
  inputShield: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    paddingVertical: 0,
    maxHeight: 76,
  },
  callBtn: {
    padding: 8,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 24,
  },
  list: {
    padding: 16,
    paddingBottom: 8,
  },
  dayRow: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dayText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  systemRow: {
    alignItems: 'center',
    marginVertical: 10,
    paddingHorizontal: 24,
  },
  systemText: {
    fontSize: 13,
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    textAlign: 'center',
    overflow: 'hidden',
    lineHeight: 18,
  },
  callAttemptText: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 16,
  },
  bubbleWrap: {
    alignSelf: 'flex-start',
    maxWidth: '80%',
    marginBottom: 8,
  },
  bubbleWrapMe: {
    alignSelf: 'flex-end',
  },
  bubble: {
    padding: 12,
    borderRadius: 16,
    position: 'relative',
  },
  bubbleMe: {
    backgroundColor: '#2563EB',
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: '#E5E7EB',
    borderBottomLeftRadius: 4,
  },
  bubbleImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 6,
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 12,
    padding: 12,
    gap: 12,
    marginBottom: 4,
    minWidth: 200,
  },
  docCardInfo: {
    flex: 1,
    minWidth: 0,
  },
  docCardName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  docCardNameMe: {
    color: '#FFFFFF',
  },
  docCardSize: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  docCardSizeMe: {
    color: 'rgba(255,255,255,0.85)',
  },
  docDownloadBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  docDownloadBtnMe: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  docDownloadText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  docDownloadTextMe: {
    color: '#FFFFFF',
  },
  bubbleText: {
    fontSize: 16,
    color: '#1F2937',
  },
  bubbleTextMe: {
    color: '#FFFFFF',
  },
  bubbleTextWithMeta: {
    paddingRight: 52,
    paddingBottom: 2,
  },
  bubbleFooter: {
    position: 'absolute',
    right: 8,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bubbleTime: {
    fontSize: 11,
    color: '#6B7280',
  },
  bubbleTimeMe: {
    color: 'rgba(255,255,255,0.8)',
  },
  checkmarksWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 2,
  },
  checkmark: {
    fontSize: 10,
  },
  checkmarkUnread: {
    color: '#9CA3AF',
  },
  checkmarkRead: {
    color: '#22C55E',
  },
  checkmarkSecond: {
    marginLeft: -4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 8,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#E5E7EB',
  },
});
