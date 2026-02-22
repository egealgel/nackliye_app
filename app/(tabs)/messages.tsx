import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/lib/auth';
import { useUnreadCount } from '@/lib/UnreadCountContext';
import { useConversations, type Conversation } from '@/hooks/useConversations';
import ConversationRow from '@/components/ConversationRow';

const PRIMARY = '#FF6B35';

export default function MessagesScreen() {
  const { session } = useAuth();
  const currentUserId = session?.user?.id;
  const { conversations, isLoading, refresh } = useConversations(currentUserId);
  const { refresh: refreshUnread } = useUnreadCount();
  const [refreshing, setRefreshing] = React.useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshUnread();
    }, [refresh, refreshUnread])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh(), refreshUnread()]);
    setRefreshing(false);
  }, [refresh, refreshUnread]);

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => <ConversationRow conversation={item} />,
    []
  );

  const keyExtractor = useCallback((item: Conversation) => item.id, []);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      </View>
    );
  }

  if (conversations.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="chatbubbles-outline" size={64} color="#D1D5DB" />
          </View>
          <Text style={styles.emptyTitle}>Henüz mesajınız yok</Text>
          <Text style={styles.emptySubtitle}>
            Bir yüke "Mesaj Gönder" dediğinizde{'\n'}sohbet burada listelenecek.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={PRIMARY}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 24,
  },
  list: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 0,
  },
});
