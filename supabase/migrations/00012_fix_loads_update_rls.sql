-- Fix: Allow assigned driver to update load status (e.g. mark as delivered).
-- Migration 00003 overwrote the initial policy to be owner-only.
-- This restores the intended behavior: both owner and assigned driver can update.

DROP POLICY IF EXISTS "loads_update" ON loads;

CREATE POLICY "loads_update" ON loads FOR UPDATE USING (
  auth.uid() = user_id OR auth.uid() = assigned_to
);
