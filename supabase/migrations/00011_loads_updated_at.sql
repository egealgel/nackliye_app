-- Add updated_at to loads so we can filter by "recently modified" (e.g. assigned this week)
ALTER TABLE loads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE loads SET updated_at = created_at WHERE updated_at IS NULL;
ALTER TABLE loads ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE loads ALTER COLUMN updated_at SET NOT NULL;

-- Trigger to set updated_at on UPDATE
CREATE OR REPLACE FUNCTION update_loads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS loads_updated_at_trigger ON loads;
CREATE TRIGGER loads_updated_at_trigger
  BEFORE UPDATE ON loads
  FOR EACH ROW
  EXECUTE FUNCTION update_loads_updated_at();
