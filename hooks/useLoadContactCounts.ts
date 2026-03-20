import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/services/supabase';

/**
 * Returns count of unique people who messaged or called (contacted) the owner per load.
 * Used for "X kişi ilgilendi" badge on Paylaştığım İşler cards.
 */
export function useLoadContactCounts(
  loadIds: string[],
  ownerId: string | undefined,
): { counts: Record<string, number>; refresh: () => Promise<void> } {
  const [counts, setCounts] = useState<Record<string, number>>({});

  const fetchCounts = useCallback(async () => {
    if (!ownerId || loadIds.length === 0) {
      setCounts({});
      return;
    }

    const { data: messages, error } = await supabase
      .from('messages')
      .select('load_id, sender_id')
      .in('load_id', loadIds)
      .neq('sender_id', ownerId)
      .in('message_type', ['text', 'image', 'document', 'call_attempt']);

    if (error) {
      setCounts({});
      return;
    }

    const byLoad = new Map<string, Set<string>>();
    for (const m of messages ?? []) {
      if (!byLoad.has(m.load_id)) byLoad.set(m.load_id, new Set());
      byLoad.get(m.load_id)!.add(m.sender_id);
    }
    const result: Record<string, number> = {};
    loadIds.forEach((id) => {
      result[id] = byLoad.get(id)?.size ?? 0;
    });
    setCounts(result);
  }, [loadIds.join(','), ownerId]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  return { counts, refresh: fetchCounts };
}
