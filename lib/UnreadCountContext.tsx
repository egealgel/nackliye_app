import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/lib/auth';

type UnreadCountContextType = {
  count: number;
  refresh: () => Promise<void>;
};

const UnreadCountContext = createContext<UnreadCountContextType | null>(null);

export function UnreadCountProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!session?.user?.id) {
      setCount(0);
      return;
    }
    const { count: unread } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', session.user.id)
      .is('read_at', null);
    setCount(unread ?? 0);
  }, [session?.user?.id]);

  useEffect(() => {
    // İlk yüklemede tam sayımı çek
    fetchCount();

    const userId = session?.user?.id;
    if (!userId) return;

    const channel = supabase
      .channel('unread-messages')
      // Yeni mesaj geldiğinde (INSERT) ve bu kullanıcı alıcı ise sayacı artır
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${userId}`,
        },
        (payload) => {
          const row: any = payload.new;
          if (row?.receiver_id === userId && row.read_at == null) {
            setCount((prev) => (prev || 0) + 1);
          }
        }
      )
      // Bir mesaj okunup read_at null'dan dolu hale geçince sayacı azalt
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${userId}`,
        },
        (payload) => {
          const oldRow: any = payload.old;
          const newRow: any = payload.new;
          if (
            oldRow?.receiver_id === userId &&
            oldRow.read_at == null &&
            newRow?.read_at != null
          ) {
            setCount((prev) => Math.max(0, (prev || 0) - 1));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, fetchCount]);

  return (
    <UnreadCountContext.Provider value={{ count, refresh: fetchCount }}>
      {children}
    </UnreadCountContext.Provider>
  );
}

export function useUnreadCount() {
  const ctx = useContext(UnreadCountContext);
  if (!ctx) throw new Error('useUnreadCount must be used within UnreadCountProvider');
  return ctx;
}
