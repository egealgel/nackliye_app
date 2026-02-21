import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { MessageSender } from '@/types/load';

export function useLoadMessageSenders(loadId: string | null, loadOwnerId: string | null) {
  const [senders, setSenders] = useState<MessageSender[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSenders = useCallback(async () => {
    if (!loadId || !loadOwnerId) {
      setSenders([]);
      return;
    }

    setIsLoading(true);
    const { data: messages } = await supabase
      .from('messages')
      .select('sender_id')
      .eq('load_id', loadId)
      .eq('receiver_id', loadOwnerId);

    if (!messages || messages.length === 0) {
      setSenders([]);
      setIsLoading(false);
      return;
    }

    const uniqueSenderIds = [...new Set(messages.map((m) => m.sender_id))];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, phone')
      .in('id', uniqueSenderIds);

    const result: MessageSender[] = (profiles || []).map((p) => ({
      id: p.id,
      userId: p.id,
      name: p.name || 'Bilinmiyor',
      phone: p.phone || '',
    }));

    setSenders(result);
    setIsLoading(false);
  }, [loadId, loadOwnerId]);

  useEffect(() => {
    fetchSenders();
  }, [fetchSenders]);

  return { senders, isLoading, refresh: fetchSenders };
}
