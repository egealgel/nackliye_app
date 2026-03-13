import { useEffect, useState, useCallback } from 'react';
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

  const fetchConversations = useCallback(async () => {
    if (!currentUserId) {
      setConversations([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, load_id, content, message_type, created_at, read_at')
      .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
      .order('created_at', { ascending: false });

    if (error) {
      setConversations([]);
      setIsLoading(false);
      return;
    }

    const filtered = (messages || []).filter((m) => m.load_id != null);
    const grouped = new Map<string, typeof filtered>();

    for (const m of filtered) {
      const otherId = m.sender_id === currentUserId ? m.receiver_id : m.sender_id;
      const key = `${m.load_id!}_${otherId}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(m);
    }

    const convos: Omit<
      Conversation,
      'otherUserName' | 'otherUserPhone' | 'loadDescription' | 'loadVehicleType'
    >[] = [];
    const otherIds = new Set<string>();
    const loadIds = new Set<string>();

    function formatLastMessagePreview(msg: { content?: string | null; message_type?: string | null }): string {
      const type = msg.message_type || 'text';
      if (type === 'image') return '📷 Fotoğraf';
      if (type === 'document') {
        try {
          const meta = msg.content ? JSON.parse(msg.content) as { fileName?: string } : null;
          const name = meta?.fileName?.trim();
          return name ? `📄 ${name}` : '📄 Belge';
        } catch {
          return '📄 Belge';
        }
      }
      return (msg.content?.trim() || '').slice(0, 60) || '';
    }

    grouped.forEach((msgs, key) => {
      const [loadId, otherId] = key.split('_');
      const latest = msgs[0];
      const unreadCount = msgs.filter(
        (m) => m.receiver_id === currentUserId && m.read_at == null
      ).length;

      convos.push({
        id: key,
        loadId,
        otherUserId: otherId,
        otherUserName: '',
        otherUserPhone: '',
        fromCity: '',
        fromDistrict: '',
        toCity: '',
        toDistrict: '',
        loadDescription: '',
        loadVehicleType: null,
        lastMessage: formatLastMessagePreview(latest),
        lastMessageAt: latest.created_at,
        unreadCount,
      });
      otherIds.add(otherId);
      loadIds.add(loadId);
    });

    const [profilesRes, loadsRes] = await Promise.all([
      supabase.from('profiles').select('id, name, phone').in('id', [...otherIds]),
      supabase
        .from('loads')
        .select('id, from_city, from_district, to_city, to_district, description, vehicle_type')
        .in('id', [...loadIds]),
    ]);

    const profileMap = new Map((profilesRes.data || []).map((p) => [p.id, p]));
    const loadMap = new Map((loadsRes.data || []).map((l) => [l.id, l]));

    let result: Conversation[] = convos.map((c) => {
      const p = profileMap.get(c.otherUserId);
      const l = loadMap.get(c.loadId);
      return {
        ...c,
        otherUserName: p?.name || 'Bilinmiyor',
        otherUserPhone: p?.phone || '',
        fromCity: l?.from_city || '',
        fromDistrict: l?.from_district || '',
        toCity: l?.to_city || '',
        toDistrict: l?.to_district || '',
        loadDescription: (l?.description as string | null) || '',
        loadVehicleType: (l?.vehicle_type as string | null) ?? null,
      };
    });

    const { data: hiddenRows } = await supabase
      .from('hidden_conversations')
      .select('load_id, other_user_id')
      .eq('user_id', currentUserId);

    const hiddenSet = new Set(
      (hiddenRows || []).map((r) => `${r.load_id}_${r.other_user_id}`)
    );
    result = result.filter((c) => !hiddenSet.has(`${c.loadId}_${c.otherUserId}`));

    result.sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );

    setConversations(result);
    setIsLoading(false);
  }, [currentUserId]);

  const hideConversation = useCallback(
    async (loadId: string, otherUserId: string) => {
      if (!currentUserId) return;
      const { error } = await supabase.from('hidden_conversations').insert({
        user_id: currentUserId,
        load_id: loadId,
        other_user_id: otherUserId,
      });
      if (!error) await fetchConversations();
    },
    [currentUserId, fetchConversations]
  );

  useEffect(() => {
    fetchConversations();

    const channel = supabase
      .channel('conversations-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => fetchConversations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchConversations]);

  return { conversations, isLoading, refresh: fetchConversations, hideConversation };
}
