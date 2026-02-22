-- Add district columns to loads if missing (for route display)
ALTER TABLE loads ADD COLUMN IF NOT EXISTS from_district TEXT DEFAULT '';
ALTER TABLE loads ADD COLUMN IF NOT EXISTS to_district TEXT DEFAULT '';
