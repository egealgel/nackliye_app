-- Allow receiver to update messages (for read_at / read receipts)
DROP POLICY IF EXISTS "messages_update" ON messages;
CREATE POLICY "messages_update" ON messages FOR UPDATE USING (
  auth.uid() = sender_id OR auth.uid() = receiver_id
);
