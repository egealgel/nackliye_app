-- Create chat-media bucket for chat image uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- Policies: allow authenticated to upload and read
DROP POLICY IF EXISTS "chat_media_upload" ON storage.objects;
CREATE POLICY "chat_media_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-media');

DROP POLICY IF EXISTS "chat_media_read" ON storage.objects;
CREATE POLICY "chat_media_read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'chat-media');
