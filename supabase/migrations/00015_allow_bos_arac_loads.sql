-- Allow NULL from_city, to_city, weight_kg for vehicle_type = 'bos_arac' (empty vehicle posts)
ALTER TABLE loads ALTER COLUMN from_city DROP NOT NULL;
ALTER TABLE loads ALTER COLUMN to_city DROP NOT NULL;
ALTER TABLE loads ALTER COLUMN weight_kg DROP NOT NULL;

-- Allow NULL or positive weight
ALTER TABLE loads DROP CONSTRAINT IF EXISTS loads_weight_kg_check;
ALTER TABLE loads ADD CONSTRAINT loads_weight_kg_check CHECK (weight_kg IS NULL OR weight_kg > 0);
