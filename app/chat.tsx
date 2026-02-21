import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/services/supabase';
import RouteDisplay from '@/components/RouteDisplay';

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
};

export default function ChatScreen() {
  const { loadId, otherUserId, fromCity, fromDistrict, toCity, toDistrict } =
    useLocalSearchParams<{
      loadId: string;
      otherUserId: string;
      fromCity?: string;
      fromDistrict?: string;
      toCity?: string;
      toDistrict?: string;
    }>();

  const router = useRouter();
  const { session } = useAuth();
  const currentUserId = session?.user?.id || '';

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    if (!loadId || !otherUserId || !currentUserId) return;

    const { data } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, created_at')
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

  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel(`chat-${loadId}-${otherUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `load_id=eq.${loadId}`,
        },
        () => fetchMessages(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadId, otherUserId, fetchMessages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !loadId || !otherUserId || !currentUserId) return;

    setInput('');
    await supabase.from('messages').insert({
      sender_id: currentUserId,
      receiver_id: otherUserId,
      load_id: loadId,
      content: text,
    });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === currentUserId;
    return (
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
        <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>
          {item.content}
        </Text>
        <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>
          {new Date(item.created_at).toLocaleTimeString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    );
  };

  const hasLoadSummary =
    fromCity && fromDistrict && toCity && toDistrict;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sohbet</Text>
      </View>

      {hasLoadSummary && (
        <View style={styles.loadSummary}>
          <RouteDisplay
            fromCity={fromCity}
            fromDistrict={fromDistrict}
            toCity={toCity}
            toDistrict={toDistrict}
          />
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            Henüz mesaj yok.{'\n'}Merhaba yazarak sohbeti başlatın.
          </Text>
        </View>
      ) : (
        <FlatList
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          inverted={false}
        />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Mesaj yazın..."
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={500}
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!input.trim()}
          >
            <Ionicons
              name="send"
              size={22}
              color={input.trim() ? '#FFFFFF' : '#9CA3AF'}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  loadSummary: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
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
  bubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  bubbleMe: {
    alignSelf: 'flex-end',
    backgroundColor: '#FF6B35',
  },
  bubbleThem: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  bubbleText: {
    fontSize: 16,
    color: '#1F2937',
  },
  bubbleTextMe: {
    color: '#FFFFFF',
  },
  bubbleTime: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
  bubbleTimeMe: {
    color: 'rgba(255,255,255,0.8)',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
    color: '#1F2937',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#E5E7EB',
  },
});
