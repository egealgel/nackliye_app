import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/services/supabase';
import { VehicleType, LoadWithDetails, ProfileSnippet } from '@/types/load';

function statusPriority(status: string): number {
  if (status === 'active' || status === 'has_offers') return 1;
  if (status === 'assigned' || status === 'in_transit') return 2;
  if (status === 'delivered') return 3;
  return 4;
}

function sortLoadsByStatus<T extends { status: string; created_at: string }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const pa = statusPriority(a.status);
    const pb = statusPriority(b.status);
    if (pa !== pb) return pa - pb;
    return (
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });
}

export function useRoomLoads(vehicleType: VehicleType) {
  const [loads, setLoads] = useState<LoadWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isMounted = useRef(true);

  const fetchLoads = useCallback(async () => {
    const { data: loadsData, error: loadsErr } = await supabase
      .from('loads')
      .select('*')
      .eq('vehicle_type', vehicleType)
      .in('status', ['active', 'has_offers', 'assigned', 'in_transit', 'delivered']);

    if (loadsErr || !loadsData) {
      if (isMounted.current) {
        setLoads([]);
        setIsLoading(false);
      }
      return;
    }

    if (loadsData.length === 0) {
      if (isMounted.current) {
        setLoads([]);
        setIsLoading(false);
      }
      return;
    }

    const allUserIds = new Set<string>();
    loadsData.forEach((l) => {
      allUserIds.add(l.user_id);
      if (l.assigned_to) allUserIds.add(l.assigned_to);
    });

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, phone, rating_avg')
      .in('id', [...allUserIds]);

    const profileMap = new Map<string, ProfileSnippet>();
    (profiles || []).forEach((p) => profileMap.set(p.id, p));

    const mapped: LoadWithDetails[] = loadsData.map((l) => ({
      ...l,
      ownerName: profileMap.get(l.user_id)?.name || 'Bilinmiyor',
      ownerPhone: profileMap.get(l.user_id)?.phone || '',
      ownerRatingAvg: profileMap.get(l.user_id)?.rating_avg ?? null,
      assignedDriverName: l.assigned_to
        ? profileMap.get(l.assigned_to)?.name
        : undefined,
      assignedDriverPhone: l.assigned_to
        ? profileMap.get(l.assigned_to)?.phone
        : undefined,
      assignedDriverRatingAvg: l.assigned_to
        ? (profileMap.get(l.assigned_to)?.rating_avg ?? null)
        : undefined,
    }));

    const result = sortLoadsByStatus(mapped);

    if (isMounted.current) {
      setLoads(result);
      setIsLoading(false);
    }
  }, [vehicleType]);

  useEffect(() => {
    isMounted.current = true;
    setIsLoading(true);
    fetchLoads();

    const loadsChannel = supabase
      .channel(`room-loads-${vehicleType}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'loads',
          filter: `vehicle_type=eq.${vehicleType}`,
        },
        () => fetchLoads(),
      )
      .subscribe();

    return () => {
      isMounted.current = false;
      supabase.removeChannel(loadsChannel);
    };
  }, [vehicleType, fetchLoads]);

  return { loads, isLoading, refresh: fetchLoads };
}

export function useRoomCounts() {
  const [counts, setCounts] = useState<Record<string, number>>({});

  const fetchCounts = useCallback(async () => {
    const { data } = await supabase
      .from('loads')
      .select('vehicle_type')
      .eq('status', 'active');

    if (!data) return;

    const map: Record<string, number> = {};
    data.forEach((row) => {
      map[row.vehicle_type] = (map[row.vehicle_type] || 0) + 1;
    });
    setCounts(map);
  }, []);

  useEffect(() => {
    fetchCounts();

    const channel = supabase
      .channel('room-counts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'loads' },
        () => fetchCounts(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCounts]);

  return { counts, refresh: fetchCounts };
}

export function useAllLoads() {
  const [loads, setLoads] = useState<LoadWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isMounted = useRef(true);

  const fetchLoads = useCallback(async () => {
    const { data: loadsData, error: loadsErr } = await supabase
      .from('loads')
      .select('*')
      .in('status', ['active', 'has_offers', 'assigned', 'in_transit', 'delivered']);

    if (loadsErr || !loadsData) {
      if (isMounted.current) {
        setLoads([]);
        setIsLoading(false);
      }
      return;
    }

    if (loadsData.length === 0) {
      if (isMounted.current) {
        setLoads([]);
        setIsLoading(false);
      }
      return;
    }

    const allUserIds = new Set<string>();
    loadsData.forEach((l) => {
      allUserIds.add(l.user_id);
      if (l.assigned_to) allUserIds.add(l.assigned_to);
    });

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, phone, rating_avg')
      .in('id', [...allUserIds]);

    const profileMap = new Map<string, ProfileSnippet>();
    (profiles || []).forEach((p) => profileMap.set(p.id, p));

    const mapped: LoadWithDetails[] = loadsData.map((l) => ({
      ...l,
      ownerName: profileMap.get(l.user_id)?.name || 'Bilinmiyor',
      ownerPhone: profileMap.get(l.user_id)?.phone || '',
      ownerRatingAvg: profileMap.get(l.user_id)?.rating_avg ?? null,
      assignedDriverName: l.assigned_to
        ? profileMap.get(l.assigned_to)?.name
        : undefined,
      assignedDriverPhone: l.assigned_to
        ? profileMap.get(l.assigned_to)?.phone
        : undefined,
      assignedDriverRatingAvg: l.assigned_to
        ? (profileMap.get(l.assigned_to)?.rating_avg ?? null)
        : undefined,
    }));

    const result = sortLoadsByStatus(mapped);

    if (isMounted.current) {
      setLoads(result);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    setIsLoading(true);
    fetchLoads();

    const channel = supabase
      .channel('all-loads')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'loads' },
        () => fetchLoads()
      )
      .subscribe();

    return () => {
      isMounted.current = false;
      supabase.removeChannel(channel);
    };
  }, [fetchLoads]);

  return { loads, isLoading, refresh: fetchLoads };
}
