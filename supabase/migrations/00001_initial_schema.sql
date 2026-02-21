-- Nackliye - Freight/Logistics Sharing App
-- PostgreSQL schema for Supabase
-- Run this in Supabase SQL Editor or via: supabase db push

-- ============================================
-- ENUM TYPES
-- ============================================

CREATE TYPE load_status AS ENUM (
  'active',
  'has_offers',
  'assigned',
  'in_transit',
  'delivered',
  'cancelled'
);

CREATE TYPE offer_status AS ENUM (
  'pending',
  'accepted',
  'rejected'
);

CREATE TYPE message_type AS ENUM (
  'text',
  'image',
  'document'
);

-- ============================================
-- TABLES
-- ============================================

-- 1. profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  vehicle_type TEXT,
  rating_avg NUMERIC(3, 2) DEFAULT 0 CHECK (rating_avg >= 0 AND rating_avg <= 5),
  total_jobs INTEGER DEFAULT 0 CHECK (total_jobs >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. loads
CREATE TABLE loads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  from_city TEXT NOT NULL,
  to_city TEXT NOT NULL,
  weight_kg NUMERIC(10, 2) NOT NULL CHECK (weight_kg > 0),
  width_cm NUMERIC(8, 2) CHECK (width_cm IS NULL OR width_cm > 0),
  height_cm NUMERIC(8, 2) CHECK (height_cm IS NULL OR height_cm > 0),
  length_cm NUMERIC(8, 2) CHECK (length_cm IS NULL OR length_cm > 0),
  vehicle_type TEXT NOT NULL,
  description TEXT,
  photos TEXT[] DEFAULT '{}',
  status load_status DEFAULT 'active' NOT NULL,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. offers
CREATE TABLE offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id UUID NOT NULL REFERENCES loads(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  message TEXT,
  status offer_status DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(load_id, driver_id)
);

-- 4. messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  load_id UUID REFERENCES loads(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  message_type message_type DEFAULT 'text' NOT NULL,
  media_url TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CHECK (sender_id != receiver_id)
);

-- 5. reviews
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewed_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  load_id UUID NOT NULL REFERENCES loads(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CHECK (reviewer_id != reviewed_id),
  UNIQUE(load_id, reviewer_id, reviewed_id)
);

-- 6. notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- INDEXES
-- ============================================

-- profiles
CREATE INDEX idx_profiles_city ON profiles(city);
CREATE INDEX idx_profiles_vehicle_type ON profiles(vehicle_type) WHERE vehicle_type IS NOT NULL;
CREATE INDEX idx_profiles_rating_avg ON profiles(rating_avg DESC);

-- loads
CREATE INDEX idx_loads_user_id ON loads(user_id);
CREATE INDEX idx_loads_from_city ON loads(from_city);
CREATE INDEX idx_loads_to_city ON loads(to_city);
CREATE INDEX idx_loads_vehicle_type ON loads(vehicle_type);
CREATE INDEX idx_loads_status ON loads(status);
CREATE INDEX idx_loads_assigned_to ON loads(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_loads_created_at ON loads(created_at DESC);
CREATE INDEX idx_loads_cities ON loads(from_city, to_city);

-- offers
CREATE INDEX idx_offers_load_id ON offers(load_id);
CREATE INDEX idx_offers_driver_id ON offers(driver_id);
CREATE INDEX idx_offers_status ON offers(status);
CREATE INDEX idx_offers_created_at ON offers(created_at DESC);

-- messages
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX idx_messages_load_id ON messages(load_id) WHERE load_id IS NOT NULL;
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_conversation ON messages(sender_id, receiver_id, created_at DESC);

-- reviews
CREATE INDEX idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX idx_reviews_reviewed_id ON reviews(reviewed_id);
CREATE INDEX idx_reviews_load_id ON reviews(load_id);
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);

-- notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================
-- TRIGGER: Update rating_avg on new review
-- ============================================

CREATE OR REPLACE FUNCTION update_profile_rating_avg()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET
    rating_avg = (
      SELECT COALESCE(AVG(rating)::NUMERIC(3, 2), 0)
      FROM reviews
      WHERE reviewed_id = NEW.reviewed_id
    ),
    total_jobs = (
      SELECT COUNT(DISTINCT load_id)
      FROM reviews
      WHERE reviewed_id = NEW.reviewed_id
    )
  WHERE id = NEW.reviewed_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_rating_on_review
  AFTER INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_rating_avg();

-- Also update on review update/delete (in case rating changes)
CREATE OR REPLACE FUNCTION update_profile_rating_on_review_change()
RETURNS TRIGGER AS $$
DECLARE
  target_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_id := OLD.reviewed_id;
  ELSE
    target_id := NEW.reviewed_id;
  END IF;

  UPDATE profiles
  SET
    rating_avg = (
      SELECT COALESCE(AVG(rating)::NUMERIC(3, 2), 0)
      FROM reviews
      WHERE reviewed_id = target_id
    ),
    total_jobs = (
      SELECT COUNT(DISTINCT load_id)
      FROM reviews
      WHERE reviewed_id = target_id
    )
  WHERE id = target_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_rating_on_review_update
  AFTER UPDATE OF rating ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_rating_on_review_change();

CREATE TRIGGER trigger_update_rating_on_review_delete
  AFTER DELETE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_rating_on_review_change();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- profiles: users can read any profile, update only their own
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- loads: owners see all, others see non-cancelled; owners can CUD
CREATE POLICY "loads_select" ON loads FOR SELECT USING (
  status != 'cancelled' OR user_id = auth.uid() OR assigned_to = auth.uid()
);
CREATE POLICY "loads_insert" ON loads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "loads_update" ON loads FOR UPDATE USING (
  user_id = auth.uid() OR assigned_to = auth.uid()
);
CREATE POLICY "loads_delete" ON loads FOR DELETE USING (auth.uid() = user_id);

-- offers: visible to load owner and driver
CREATE POLICY "offers_select" ON offers FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM loads
    WHERE loads.id = offers.load_id
    AND (loads.user_id = auth.uid() OR offers.driver_id = auth.uid())
  )
);
CREATE POLICY "offers_insert" ON offers FOR INSERT WITH CHECK (auth.uid() = driver_id);
CREATE POLICY "offers_update" ON offers FOR UPDATE USING (
  driver_id = auth.uid()
  OR EXISTS (SELECT 1 FROM loads WHERE loads.id = offers.load_id AND loads.user_id = auth.uid())
);

-- messages: participants only
CREATE POLICY "messages_select" ON messages FOR SELECT USING (
  sender_id = auth.uid() OR receiver_id = auth.uid()
);
CREATE POLICY "messages_insert" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "messages_update" ON messages FOR UPDATE USING (
  sender_id = auth.uid() OR receiver_id = auth.uid()
);

-- reviews: readable by all, writable by load participants
CREATE POLICY "reviews_select" ON reviews FOR SELECT USING (true);
CREATE POLICY "reviews_insert" ON reviews FOR INSERT WITH CHECK (
  auth.uid() = reviewer_id
  AND EXISTS (
    SELECT 1 FROM loads
    WHERE loads.id = reviews.load_id
    AND loads.status = 'delivered'
    AND (loads.user_id = auth.uid() OR loads.assigned_to = auth.uid())
  )
);

-- notifications: user's own only
CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_update" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- PROFILE AUTO-CREATE (on auth signup)
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, phone, city)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'city', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-create profile when new user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
