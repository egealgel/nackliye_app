-- Document: loads table is used for both freight loads and "Boş Araç" (empty vehicle) posts.
-- Room is determined by vehicle_type; room = 'bos_arac' means vehicle_type = 'bos_arac'.
-- For vehicle_type = 'bos_arac', from_city, to_city, and weight_kg may be NULL.
-- (Nullable columns and weight check are set in 00015_allow_bos_arac_loads.sql.)
COMMENT ON COLUMN loads.vehicle_type IS 'Vehicle type / room: e.g. kamyonet, tir, bos_arac. For bos_arac, from_city, to_city, weight_kg may be NULL.';
