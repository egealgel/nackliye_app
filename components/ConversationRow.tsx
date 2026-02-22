import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Conversation } from '@/hooks/useConversations';

type Props = {
  conversation: Conversation;
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

export default function ConversationRow({ conversation }: Props) {
  const router = useRouter();
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

  return (
    <TouchableOpacity style={styles.row} onPress={openChat} activeOpacity={0.7}>
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
});
