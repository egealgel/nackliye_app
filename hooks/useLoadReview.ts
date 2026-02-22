import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/services/supabase';

/**
 * Check if current user has already reviewed the other party for this load.
 * Returns { hasReviewed, refresh }.
 */
export function useLoadReview(
  loadId: string | null,
  reviewerId: string | null,
  reviewedId: string | null
) {
  const [hasReviewed, setHasReviewed] = useState(false);

  const fetch = useCallback(async () => {
    if (!loadId || !reviewerId || !reviewedId) {
      setHasReviewed(false);
      return;
    }

    const { data } = await supabase
      .from('reviews')
      .select('id')
      .eq('load_id', loadId)
      .eq('reviewer_id', reviewerId)
      .eq('reviewed_id', reviewedId)
      .maybeSingle();

    setHasReviewed(!!data);
  }, [loadId, reviewerId, reviewedId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { hasReviewed, refresh: fetch };
}
