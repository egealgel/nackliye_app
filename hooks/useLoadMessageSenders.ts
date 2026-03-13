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
    // Interested parties = users who messaged OR called the owner (receiver_id = loadOwnerId).
    // For call_attempt, sender_id = person who tapped Ara (the caller).
    const queryFilter = {
      load_id: loadId,
      receiver_id: loadOwnerId,
      message_types: ['text', 'image', 'document', 'call_attempt'],
    };
    const { data: messages, error: queryError } = await supabase
      .from('messages')
      .select('id, sender_id, message_type')
      .eq('load_id', loadId)
      .eq('receiver_id', loadOwnerId)
      .in('message_type', ['text', 'image', 'document', 'call_attempt']);

    if (queryError) {
      setSenders([]);
      setIsLoading(false);
      return;
    }

    if (!messages || messages.length === 0) {
      setSenders([]);
      setIsLoading(false);
      return;
    }

    const uniqueSenderIds = [...new Set(messages.map((m) => m.sender_id))];
    const hasMessageBySender = new Map<string, boolean>();
    const hasCallAttemptBySender = new Map<string, boolean>();
    for (const m of messages) {
      if (m.message_type === 'call_attempt') {
        hasCallAttemptBySender.set(m.sender_id, true);
      } else {
        hasMessageBySender.set(m.sender_id, true);
      }
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, phone, vehicle_type, rating_avg, city')
      .in('id', uniqueSenderIds);

    const result: MessageSender[] = (profiles || []).map((p) => ({
      id: p.id,
      userId: p.id,
      name: p.name || 'Bilinmiyor',
      phone: p.phone || '',
      vehicleType: p.vehicle_type || null,
      ratingAvg: p.rating_avg ?? null,
      city: p.city ?? undefined,
      hasMessage: hasMessageBySender.get(p.id) ?? false,
      hasCallAttempt: hasCallAttemptBySender.get(p.id) ?? false,
    }));

    setSenders(result);
    setIsLoading(false);
  }, [loadId, loadOwnerId]);

  useEffect(() => {
    fetchSenders();
  }, [fetchSenders]);

  return { senders, isLoading, refresh: fetchSenders };
}
