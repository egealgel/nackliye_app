-- RLS policies: Read all for loads/offers/reviews; own records for CUD
-- Messages: only sender/receiver; Notifications: own only

-- ============================================
-- DROP EXISTING POLICIES
-- ============================================

DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;

DROP POLICY IF EXISTS "loads_select" ON loads;
DROP POLICY IF EXISTS "loads_insert" ON loads;
DROP POLICY IF EXISTS "loads_update" ON loads;
DROP POLICY IF EXISTS "loads_delete" ON loads;

DROP POLICY IF EXISTS "offers_select" ON offers;
DROP POLICY IF EXISTS "offers_insert" ON offers;
DROP POLICY IF EXISTS "offers_update" ON offers;

DROP POLICY IF EXISTS "messages_select" ON messages;
DROP POLICY IF EXISTS "messages_insert" ON messages;
DROP POLICY IF EXISTS "messages_update" ON messages;

DROP POLICY IF EXISTS "reviews_select" ON reviews;
DROP POLICY IF EXISTS "reviews_insert" ON reviews;

DROP POLICY IF EXISTS "notifications_select" ON notifications;
DROP POLICY IF EXISTS "notifications_update" ON notifications;

-- ============================================
-- ENABLE RLS (idempotent)
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES
-- Read all; insert/update/delete own only
-- ============================================

CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_delete" ON profiles FOR DELETE USING (auth.uid() = id);

-- ============================================
-- LOADS
-- Read all; insert/update/delete own only (user_id)
-- ============================================

CREATE POLICY "loads_select" ON loads FOR SELECT USING (true);
CREATE POLICY "loads_insert" ON loads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "loads_update" ON loads FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "loads_delete" ON loads FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- OFFERS
-- Read all; insert/update/delete own only (driver_id)
-- ============================================

CREATE POLICY "offers_select" ON offers FOR SELECT USING (true);
CREATE POLICY "offers_insert" ON offers FOR INSERT WITH CHECK (auth.uid() = driver_id);
CREATE POLICY "offers_update" ON offers FOR UPDATE USING (auth.uid() = driver_id);
CREATE POLICY "offers_delete" ON offers FOR DELETE USING (auth.uid() = driver_id);

-- ============================================
-- MESSAGES
-- Read only where sender or receiver; insert/update/delete own only (sender)
-- ============================================

CREATE POLICY "messages_select" ON messages FOR SELECT USING (
  sender_id = auth.uid() OR receiver_id = auth.uid()
);
CREATE POLICY "messages_insert" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "messages_update" ON messages FOR UPDATE USING (auth.uid() = sender_id);
CREATE POLICY "messages_delete" ON messages FOR DELETE USING (auth.uid() = sender_id);

-- ============================================
-- REVIEWS
-- Read all; insert/update/delete own only (reviewer_id)
-- ============================================

CREATE POLICY "reviews_select" ON reviews FOR SELECT USING (true);
CREATE POLICY "reviews_insert" ON reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id);
CREATE POLICY "reviews_update" ON reviews FOR UPDATE USING (auth.uid() = reviewer_id);
CREATE POLICY "reviews_delete" ON reviews FOR DELETE USING (auth.uid() = reviewer_id);

-- ============================================
-- NOTIFICATIONS
-- Read/insert/update/delete own only
-- ============================================

CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_insert" ON notifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notifications_update" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notifications_delete" ON notifications FOR DELETE USING (auth.uid() = user_id);
