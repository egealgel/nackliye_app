-- Add delivery_photo_url for proof when status = delivered
ALTER TABLE loads ADD COLUMN IF NOT EXISTS delivery_photo_url TEXT;
