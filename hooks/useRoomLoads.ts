import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/services/supabase';
import { VehicleType, LoadWithDetails, ProfileSnippet } from '@/types/load';

export type DateFilter = 'today' | '3days' | 'week' | 'all';
export type StatusFilter = 'active' | 'assigned' | 'all';

export type RoomFilters = {
  fromCity: string | null;
  fromDistrict: string | null;
  toCity: string | null;
  dateFilter: DateFilter;
  statusFilter: StatusFilter;
};

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

function getDateFilterGte(filter: DateFilter): string | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (filter === 'today') return today.toISOString();
  if (filter === '3days') {
    const d = new Date(today);
    d.setDate(d.getDate() - 3);
    return d.toISOString();
  }
  if (filter === 'week') {
    const d = new Date(today);
    const day = d.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + mondayOffset);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  return null; // all
}

function getStatusList(filter: StatusFilter): string[] {
  if (filter === 'active') return ['active', 'has_offers'];
  if (filter === 'assigned') return ['assigned'];
  return ['active', 'has_offers', 'assigned', 'in_transit', 'delivered'];
}

export function useRoomLoads(vehicleType: VehicleType, filters: RoomFilters) {
  const [loads, setLoads] = useState<LoadWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isMounted = useRef(true);

  const fetchLoads = useCallback(async () => {
    const statusList = getStatusList(filters.statusFilter);
    const dateGte = getDateFilterGte(filters.dateFilter);

    let query = supabase
      .from('loads')
      .select('*')
      .eq('vehicle_type', vehicleType)
      .in('status', statusList);

    if (filters.fromCity) {
      query = query.eq('from_city', filters.fromCity);
      if (filters.fromDistrict) {
        query = query.eq('from_district', filters.fromDistrict);
      }
    }
    if (filters.toCity) {
      query = query.eq('to_city', filters.toCity);
    }

    if (dateGte) {
      // "İş Verildi": use updated_at only (load was created earlier, assigned recently)
      // Other statuses: use created_at (when posted) or updated_at (covers both)
      if (filters.statusFilter === 'assigned') {
        query = query.gte('updated_at', dateGte);
      } else {
        query = query.or(`created_at.gte.${dateGte},updated_at.gte.${dateGte}`);
      }
    }

    let result = await query;
    let loadsData = result.data;
    let loadsErr = result.error;

    if (loadsErr) {
      // If updated_at column doesn't exist (migration not run), retry with created_at for assigned
      if (
        filters.statusFilter === 'assigned' &&
        dateGte &&
        loadsErr.message?.toLowerCase().includes('updated_at')
      ) {
        let fallbackQuery = supabase
          .from('loads')
          .select('*')
          .eq('vehicle_type', vehicleType)
          .in('status', statusList)
          .gte('created_at', dateGte);
        if (filters.fromCity) {
          fallbackQuery = fallbackQuery.eq('from_city', filters.fromCity);
          if (filters.fromDistrict) fallbackQuery = fallbackQuery.eq('from_district', filters.fromDistrict);
        }
        if (filters.toCity) fallbackQuery = fallbackQuery.eq('to_city', filters.toCity);
        const fb = await fallbackQuery;
        loadsData = fb.data;
        loadsErr = fb.error;
      }
    }

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

    const sortedResult = sortLoadsByStatus(mapped);

    if (isMounted.current) {
      setLoads(sortedResult);
      setIsLoading(false);
    }
  }, [vehicleType, filters.fromCity, filters.fromDistrict, filters.toCity, filters.dateFilter, filters.statusFilter]);

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

export function useMyLoads(userId: string | undefined) {
  const [loads, setLoads] = useState<LoadWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isMounted = useRef(true);

  const fetchLoads = useCallback(async () => {
    if (!userId) {
      if (isMounted.current) {
        setLoads([]);
        setIsLoading(false);
      }
      return;
    }

    const { data: loadsData, error: loadsErr } = await supabase
      .from('loads')
      .select('*')
      .or(`user_id.eq.${userId},assigned_to.eq.${userId}`)
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
  }, [userId]);

  useEffect(() => {
    isMounted.current = true;
    setIsLoading(true);
    fetchLoads();

    const channel = supabase
      .channel('my-loads')
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
  }, [userId, fetchLoads]);

  return { loads, isLoading, refresh: fetchLoads };
}
