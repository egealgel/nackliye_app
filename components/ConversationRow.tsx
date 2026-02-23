import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Conversation } from '@/hooks/useConversations';

const CONFIRM_MESSAGE =
  'Bu sohbet listenizden kaldırılacak. Karşı tarafın mesajları etkilenmez.';

type Props = {
  conversation: Conversation;
  onHide: (loadId: string, otherUserId: string) => void;
};

const PRIMARY = '#FF6B35';

function routeSubtitle(
  fromCity: string,
  fromDistrict: string,
  toCity: string,
  toDistrict: string
): string {
  const from = [fromCity, fromDistrict].filter(Boolean).join('/');
  const to = [toCity, toDistrict].filter(Boolean).join('/');
  return from && to ? `${from} → ${to}` : '';
}

function renderRightActions(
  onPress: () => void
): React.ReactNode {
  return (
    <TouchableOpacity
      style={styles.deleteAction}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
      <Text style={styles.deleteActionText}>Sil</Text>
    </TouchableOpacity>
  );
}

export default function ConversationRow({ conversation, onHide }: Props) {
  const router = useRouter();
  const swipeableRef = useRef<Swipeable | null>(null);

  const routeStr = routeSubtitle(
    conversation.fromCity,
    conversation.fromDistrict,
    conversation.toCity,
    conversation.toDistrict
  );

  const openChat = () => {
    router.push({
      pathname: '/chat',
      params: {
        loadId: conversation.loadId,
        otherUserId: conversation.otherUserId,
        otherUserName: conversation.otherUserName,
        otherUserPhone: conversation.otherUserPhone,
        fromCity: conversation.fromCity,
        fromDistrict: conversation.fromDistrict,
        toCity: conversation.toCity,
        toDistrict: conversation.toDistrict,
      },
    });
  };

  const confirmAndHide = () => {
    Alert.alert(
      'Sohbeti Kaldır',
      CONFIRM_MESSAGE,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => onHide(conversation.loadId, conversation.otherUserId),
        },
      ]
    );
  };

  const handleLongPress = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['İptal', 'Sohbeti Sil'],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 0,
          title: 'Sohbet',
          message: CONFIRM_MESSAGE,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) confirmAndHide();
        }
      );
    } else {
      confirmAndHide();
    }
  };

  const timeStr = (() => {
    const d = new Date(conversation.lastMessageAt);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) {
      return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    }
    if (diff < 604800000) {
      return d.toLocaleDateString('tr-TR', { weekday: 'short' });
    }
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  })();

  const rowContent = (
    <TouchableOpacity
      style={styles.row}
      onPress={openChat}
      onLongPress={handleLongPress}
      activeOpacity={0.7}
      delayLongPress={400}
    >
      <View style={styles.avatar}>
        <Ionicons name="person" size={24} color="#9CA3AF" />
      </View>
      <View style={styles.content}>
        <View style={styles.top}>
          <Text style={styles.name} numberOfLines={1}>
            {conversation.otherUserName}
          </Text>
          <Text style={styles.time}>{timeStr}</Text>
        </View>
        {routeStr ? (
          <Text style={styles.routeSubtitle} numberOfLines={1}>
            {routeStr}
          </Text>
        ) : null}
        {conversation.lastMessage ? (
          <Text
            style={[styles.preview, conversation.unreadCount > 0 && styles.previewUnread]}
            numberOfLines={1}
          >
            {conversation.lastMessage}
          </Text>
        ) : null}
      </View>
      {conversation.unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={() => renderRightActions(() => {
        swipeableRef.current?.close();
        confirmAndHide();
      })}
      friction={2}
      rightThreshold={40}
    >
      {rowContent}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
    marginRight: 8,
  },
  time: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  routeSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 2,
  },
  preview: {
    fontSize: 14,
    color: '#6B7280',
  },
  previewUnread: {
    fontWeight: '600',
    color: '#1F2937',
  },
  badge: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  deleteAction: {
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    paddingHorizontal: 16,
  },
  deleteActionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
});
