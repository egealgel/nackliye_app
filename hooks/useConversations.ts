import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/services/supabase';

export type Conversation = {
  id: string;
  loadId: string;
  otherUserId: string;
  otherUserName: string;
  otherUserPhone: string;
  fromCity: string;
  fromDistrict: string;
  toCity: string;
  toDistrict: string;
  /** Load description (used for Boş Araç conversations where route is empty) */
  loadDescription: string;
  /** Load vehicle type (e.g. bos_arac) */
  loadVehicleType: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
};

export function useConversations(currentUserId: string | undefined) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const MESSAGE_PAGE_SIZE = 200;
  const messageOffsetRef = useRef(0);
  const convoBaseRef = useRef<
    Map<
      string,
      {
        loadId: string;
        otherUserId: string;
        lastMessage: string;
        lastMessageAt: string;
        unreadCount: number;
      }
    >
  >(new Map());
  const profileCacheRef = useRef<Map<string, { id: string; name: string | null; phone: string | null }>>(new Map());
  const loadCacheRef = useRef<
    Map<
      string,
      {
        id: string;
        from_city: string | null;
        from_district: string | null;
        to_city: string | null;
        to_district: string | null;
        description: string | null;
        vehicle_type: string | null;
      }
    >
  >(new Map());

  function formatLastMessagePreview(msg: { content?: string | null; message_type?: string | null }): string {
    const type = msg.message_type || 'text';
    if (type === 'image') return '📷 Fotoğraf';
    if (type === 'document') {
      try {
        const meta = msg.content ? (JSON.parse(msg.content) as { fileName?: string }) : null;
        const name = meta?.fileName?.trim();
        return name ? `📄 ${name}` : '📄 Belge';
      } catch {
        return '📄 Belge';
      }
    }
    return (msg.content?.trim() || '').slice(0, 60) || '';
  }

  const rebuildConversationList = useCallback(async () => {
    if (!currentUserId) return;

    const base = [...convoBaseRef.current.values()].sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
    );

    let result: Conversation[] = base.map((c) => {
      const p = profileCacheRef.current.get(c.otherUserId);
      const l = loadCacheRef.current.get(c.loadId);
      return {
        id: `${c.loadId}_${c.otherUserId}`,
        loadId: c.loadId,
        otherUserId: c.otherUserId,
        otherUserName: p?.name || 'Bilinmiyor',
        otherUserPhone: p?.phone || '',
        fromCity: l?.from_city || '',
        fromDistrict: l?.from_district || '',
        toCity: l?.to_city || '',
        toDistrict: l?.to_district || '',
        loadDescription: l?.description || '',
        loadVehicleType: l?.vehicle_type ?? null,
        lastMessage: c.lastMessage,
        lastMessageAt: c.lastMessageAt,
        unreadCount: c.unreadCount,
      };
    });

    const { data: hiddenRows } = await supabase
      .from('hidden_conversations')
      .select('load_id, other_user_id, hidden_at')
      .eq('user_id', currentUserId);

    const hiddenMap = new Map(
      (hiddenRows || []).map((r) => [
        `${r.load_id}_${r.other_user_id}`,
        r as { load_id: string; other_user_id: string; hidden_at: string | null },
      ]),
    );

    const toUnhideKeys: string[] = [];

    result = result.filter((c) => {
      const key = `${c.loadId}_${c.otherUserId}`;
      const hidden = hiddenMap.get(key);
      if (!hidden) return true;

      if (!hidden.hidden_at) {
        return false;
      }

      const lastMessageTime = new Date(c.lastMessageAt).getTime();
      const hiddenAtTime = new Date(hidden.hidden_at).getTime();

      if (Number.isNaN(lastMessageTime) || Number.isNaN(hiddenAtTime)) {
        return false;
      }

      if (lastMessageTime > hiddenAtTime) {
        toUnhideKeys.push(key);
        return true;
      }

      return false;
    });

    if (toUnhideKeys.length > 0) {
      await Promise.all(
        toUnhideKeys.map((key) => {
          const [loadId, otherUserId] = key.split('_');
          return supabase
            .from('hidden_conversations')
            .delete()
            .eq('user_id', currentUserId)
            .eq('load_id', loadId)
            .eq('other_user_id', otherUserId);
        }),
      );
    }

    setConversations(result);
  }, [currentUserId]);

  const fetchMessagePage = useCallback(async (replace: boolean) => {
    if (!currentUserId) {
      setConversations([]);
      setIsLoading(false);
      return;
    }

    const offset = replace ? 0 : messageOffsetRef.current;
    const to = offset + MESSAGE_PAGE_SIZE - 1;
    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, load_id, content, message_type, created_at, read_at')
      .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
      .order('created_at', { ascending: false })
      .range(offset, to);

    if (error) {
      setConversations([]);
      setIsLoading(false);
      return;
    }

    const filtered = (messages || []).filter((m) => m.load_id != null);
    const newOtherIds = new Set<string>();
    const newLoadIds = new Set<string>();

    if (replace) {
      convoBaseRef.current = new Map();
      profileCacheRef.current = new Map();
      loadCacheRef.current = new Map();
      messageOffsetRef.current = 0;
      setHasMore(true);
    }

    for (const m of filtered) {
      const otherId = m.sender_id === currentUserId ? m.receiver_id : m.sender_id;
      const key = `${m.load_id!}_${otherId}`;
      const existing = convoBaseRef.current.get(key);
      if (!existing) {
        convoBaseRef.current.set(key, {
          loadId: String(m.load_id),
          otherUserId: String(otherId),
          lastMessage: formatLastMessagePreview(m),
          lastMessageAt: m.created_at,
          unreadCount: m.receiver_id === currentUserId && m.read_at == null ? 1 : 0,
        });
      } else {
        if (m.receiver_id === currentUserId && m.read_at == null) {
          existing.unreadCount += 1;
        }
      }

      if (!profileCacheRef.current.has(String(otherId))) newOtherIds.add(String(otherId));
      if (!loadCacheRef.current.has(String(m.load_id))) newLoadIds.add(String(m.load_id));
    }

    if (newOtherIds.size > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, name, phone')
        .in('id', [...newOtherIds]);
      (profs || []).forEach((p) => profileCacheRef.current.set(p.id, p));
    }

    if (newLoadIds.size > 0) {
      const { data: loads } = await supabase
        .from('loads')
        .select('id, from_city, from_district, to_city, to_district, description, vehicle_type')
        .in('id', [...newLoadIds]);
      (loads || []).forEach((l) => loadCacheRef.current.set(l.id, l));
    }

    messageOffsetRef.current = offset + (messages?.length ?? 0);
    setHasMore((messages?.length ?? 0) === MESSAGE_PAGE_SIZE);

    await rebuildConversationList();
    setIsLoading(false);
    setIsLoadingMore(false);
  }, [MESSAGE_PAGE_SIZE, currentUserId, rebuildConversationList]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setIsLoadingMore(false);
    await fetchMessagePage(true);
  }, [fetchMessagePage]);

  const loadMore = useCallback(async () => {
    if (isLoading || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    await fetchMessagePage(false);
  }, [fetchMessagePage, hasMore, isLoading, isLoadingMore]);

  const hideConversation = useCallback(
    async (loadId: string, otherUserId: string) => {
      if (!currentUserId) return;
      const { error } = await supabase.from('hidden_conversations').insert({
        user_id: currentUserId,
        load_id: loadId,
        other_user_id: otherUserId,
      });
      if (!error) await refresh();
    },
    [currentUserId, refresh]
  );

  useEffect(() => {
    refresh();

    const channel = supabase
      .channel('conversations-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { conversations, isLoading, isLoadingMore, hasMore, refresh, loadMore, hideConversation };
}
