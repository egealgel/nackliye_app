import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/services/supabase';
import { VehicleType, LoadWithDetails, ProfileSnippet } from '@/types/load';

export type DateFilter = 'today' | '3days' | 'week' | 'all';
export type StatusFilter = 'active' | 'assigned' | 'all';

export type RoomFilters = {
  fromCities: string[];
  fromCityDistricts: Record<string, string[]>; // city -> districts; empty = all districts
  toCities: string[];
  toCityDistricts: Record<string, string[]>; // city -> districts for destination
  dateFilter: DateFilter;
  statusFilter: StatusFilter;
};

/** 12 hours in ms for Odalar "fresh" vs "stale" active split */
const FRESH_ACTIVE_MS = 12 * 60 * 60 * 1000;

/**
 * Sort key for Odalar (Rooms): 0 = fresh active, 1 = stale active, 2 = assigned/in_transit, 3 = delivered.
 * Fresh = active/has_offers and created_at within last 12 hours.
 */
function roomSortKey(item: { status: string; created_at: string }): number {
  const created = new Date(item.created_at).getTime();
  const now = Date.now();
  const isActive = item.status === 'active' || item.status === 'has_offers';

  if (isActive) {
    return now - created < FRESH_ACTIVE_MS ? 0 : 1; // 0 fresh, 1 stale
  }
  if (item.status === 'assigned' || item.status === 'in_transit') return 2;
  if (item.status === 'delivered') return 3;
  return 4;
}

/** Sort room loads: fresh active → stale active → assigned → delivered; within each group by created_at desc */
function sortRoomLoads<T extends { status: string; created_at: string }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const ka = roomSortKey(a);
    const kb = roomSortKey(b);
    if (ka !== kb) return ka - kb;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

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
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);
  const profileCacheRef = useRef<Map<string, ProfileSnippet>>(new Map());
  const isMounted = useRef(true);

  const PAGE_SIZE = 20;

  const fetchPage = useCallback(async (page: number, replace: boolean) => {
    const statusList = getStatusList(filters.statusFilter);
    const dateGte = getDateFilterGte(filters.dateFilter);

    let query = supabase
      .from('loads')
      .select('*')
      .eq('vehicle_type', vehicleType)
      .in('status', statusList)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (filters.fromCities.length > 0) {
      query = query.in('from_city', filters.fromCities);
    }
    if (filters.toCities.length > 0) {
      query = query.in('to_city', filters.toCities);
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
          .gte('created_at', dateGte)
          .order('created_at', { ascending: false })
          .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
        if (filters.fromCities.length > 0) fallbackQuery = fallbackQuery.in('from_city', filters.fromCities);
        if (filters.toCities.length > 0) fallbackQuery = fallbackQuery.in('to_city', filters.toCities);
        const fb = await fallbackQuery;
        loadsData = fb.data;
        loadsErr = fb.error;
      }
    }

    if (loadsErr || !loadsData) {
      if (isMounted.current) {
        if (replace) setLoads([]);
        setIsLoading(false);
        setIsLoadingMore(false);
        setHasMore(false);
      }
      return;
    }

    if (loadsData.length === 0) {
      if (isMounted.current) {
        if (replace) setLoads([]);
        setIsLoading(false);
        setIsLoadingMore(false);
        setHasMore(false);
      }
      return;
    }

    // Filter by district in memory (from and to)
    let filteredByDistrict = loadsData;
    const fromCitiesWithDistricts = filters.fromCities.filter(
      (c) => (filters.fromCityDistricts?.[c]?.length ?? 0) > 0
    );
    if (fromCitiesWithDistricts.length > 0) {
      filteredByDistrict = filteredByDistrict.filter((l) => {
        const cityDists = filters.fromCityDistricts?.[l.from_city];
        if (!cityDists || cityDists.length === 0) return filters.fromCities.includes(l.from_city);
        return cityDists.includes(l.from_district ?? '');
      });
    }
    const toCitiesWithDistricts = filters.toCities.filter(
      (c) => (filters.toCityDistricts?.[c]?.length ?? 0) > 0
    );
    if (toCitiesWithDistricts.length > 0) {
      filteredByDistrict = filteredByDistrict.filter((l) => {
        const cityDists = filters.toCityDistricts?.[l.to_city];
        if (!cityDists || cityDists.length === 0) return filters.toCities.includes(l.to_city);
        return cityDists.includes(l.to_district ?? '');
      });
    }

    const allUserIds = new Set<string>();
    filteredByDistrict.forEach((l) => {
      allUserIds.add(l.user_id);
      if (l.assigned_to) allUserIds.add(l.assigned_to);
    });

    const missingIds = [...allUserIds].filter((id) => !profileCacheRef.current.has(id));
    if (missingIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, phone, rating_avg')
        .in('id', missingIds);
      (profiles || []).forEach((p) => profileCacheRef.current.set(p.id, p));
    }

    const mapped: LoadWithDetails[] = filteredByDistrict.map((l) => ({
      ...l,
      ownerName: profileCacheRef.current.get(l.user_id)?.name || 'Bilinmiyor',
      ownerPhone: profileCacheRef.current.get(l.user_id)?.phone || '',
      ownerRatingAvg: profileCacheRef.current.get(l.user_id)?.rating_avg ?? null,
      assignedDriverName: l.assigned_to
        ? profileCacheRef.current.get(l.assigned_to)?.name
        : undefined,
      assignedDriverPhone: l.assigned_to
        ? profileCacheRef.current.get(l.assigned_to)?.phone
        : undefined,
      assignedDriverRatingAvg: l.assigned_to
        ? (profileCacheRef.current.get(l.assigned_to)?.rating_avg ?? null)
        : undefined,
    }));

    const sortedResult = replace ? mapped : sortRoomLoads(mapped);

    if (isMounted.current) {
      setHasMore(loadsData.length === PAGE_SIZE);
      pageRef.current = page;
      setLoads((prev) => {
        const next = replace ? sortedResult : [...prev, ...sortedResult];
        const uniq = new Map(next.map((x) => [x.id, x]));
        return sortRoomLoads([...uniq.values()]);
      });
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [vehicleType, filters.fromCities, filters.fromCityDistricts, filters.toCities, filters.toCityDistricts, filters.dateFilter, filters.statusFilter]);

  useEffect(() => {
    isMounted.current = true;
    setIsLoading(true);
    profileCacheRef.current = new Map();
    pageRef.current = 0;
    setHasMore(true);
    fetchPage(0, true);

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
        () => {
          profileCacheRef.current = new Map();
          pageRef.current = 0;
          setHasMore(true);
          setIsLoading(true);
          fetchPage(0, true);
        },
      )
      .subscribe();

    return () => {
      isMounted.current = false;
      supabase.removeChannel(loadsChannel);
    };
  }, [vehicleType, fetchPage]);

  const removeLoad = useCallback((loadId: string) => {
    setLoads((prev) => prev.filter((l) => l.id !== loadId));
  }, []);

  const refresh = useCallback(async () => {
    if (!isMounted.current) return;
    setIsLoading(true);
    setIsLoadingMore(false);
    profileCacheRef.current = new Map();
    pageRef.current = 0;
    setHasMore(true);
    await fetchPage(0, true);
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (isLoading || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    await fetchPage(pageRef.current + 1, false);
  }, [fetchPage, hasMore, isLoading, isLoadingMore]);

  return { loads, isLoading, isLoadingMore, hasMore, refresh, loadMore, removeLoad };
}

export function useRoomCounts(filters?: RoomFilters) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  const fetchCounts = useCallback(async () => {
    // If no filters provided, default to active-only counts (previous behavior)
    if (!filters) {
      const { data } = await supabase
        .from('loads')
        .select('vehicle_type')
        .eq('status', 'active');

      if (!data) return;

      const map: Record<string, number> = {};
      data.forEach((row) => {
        map[row.vehicle_type] = (map[row.vehicle_type] || 0) + 1;
      });

      // Special case: Boş Araç badge should always show unfiltered
      // count of bos_arac loads with status IN ('active', 'has_offers'),
      // regardless of any filters.
      const { data: bosData } = await supabase
        .from('loads')
        .select('vehicle_type')
        .eq('vehicle_type', 'bos_arac')
        .in('status', ['active', 'has_offers']);

      if (bosData) {
        map['bos_arac'] = bosData.length;
      }

      setCounts(map);
      return;
    }

    const statusList = getStatusList(filters.statusFilter);
    const dateGte = getDateFilterGte(filters.dateFilter);

    // For filtered mode:
    // - Non-Boş Araç rooms: apply filters (from/to/date/status)
    // - Boş Araç badge: always show total unfiltered active bos_arac count

    // 1) Filtered query for all vehicle types EXCEPT bos_arac
    let query = supabase
      .from('loads')
      .select('vehicle_type, from_city, to_city, status, created_at, updated_at')
      .in('status', statusList);

    if (filters.fromCities.length > 0) {
      query = query.in('from_city', filters.fromCities);
    }
    if (filters.toCities.length > 0) {
      query = query.in('to_city', filters.toCities);
    }

    if (dateGte) {
      if (filters.statusFilter === 'assigned') {
        query = query.gte('updated_at', dateGte);
      } else {
        query = query.or(`created_at.gte.${dateGte},updated_at.gte.${dateGte}`);
      }
    }

    // Exclude bos_arac from filtered query; we'll handle it separately
    query = query.neq('vehicle_type', 'bos_arac');

    const [filteredRes, bosRes] = await Promise.all([
      query,
      supabase
        .from('loads')
        .select('vehicle_type')
        .eq('vehicle_type', 'bos_arac')
        .in('status', ['active', 'has_offers']),
    ]);

    const data = filteredRes.data;
    const error = filteredRes.error;
    const bosData = bosRes.data;

    if (!error && data) {
      const map: Record<string, number> = {};
      data.forEach((row) => {
        map[row.vehicle_type] = (map[row.vehicle_type] || 0) + 1;
      });

      // Add unfiltered Boş Araç count (always active-only, ignoring filters)
      if (bosData) {
        map['bos_arac'] = bosData.length;
      }

      setCounts(map);
    }
  }, [filters]);

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
