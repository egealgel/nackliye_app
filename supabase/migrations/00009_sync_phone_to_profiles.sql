-- Fix: Phone OTP stores phone in auth.users.phone, not raw_user_meta_data.
-- The handle_new_user trigger used raw_user_meta_data->>'phone' which is empty for OTP sign-in.
-- Update trigger to use auth.users.phone and backfill existing profiles.

-- 1. Update trigger to copy phone from auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, phone, city)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), ''),
      NEW.phone,
      ''
    ),
    COALESCE(NEW.raw_user_meta_data->>'city', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Backfill profiles.phone from auth.users for existing users
UPDATE public.profiles p
SET phone = u.phone
FROM auth.users u
WHERE p.id = u.id
  AND u.phone IS NOT NULL
  AND TRIM(u.phone) != ''
  AND (p.phone IS NULL OR TRIM(p.phone) = '');
