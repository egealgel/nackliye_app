-- Enable Supabase Realtime for loads table
-- Required for postgres_changes to receive INSERT/UPDATE/DELETE events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'loads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE loads;
  END IF;
END
$$;
