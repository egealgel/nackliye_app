-- Add expo_push_token to profiles for push notifications
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS expo_push_token TEXT;
