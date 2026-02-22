# Database Webhooks for Push Notifications

Configure these webhooks in **Supabase Dashboard** → **Database** → **Webhooks**:

## 1. New Message → Push notification
- **Table:** `messages`
- **Events:** INSERT
- **URL:** `https://YOUR_PROJECT.supabase.co/functions/v1/on-new-message`
- **HTTP Headers:** `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`

## 2. New Load → Push notification
- **Table:** `loads`
- **Events:** INSERT
- **URL:** `https://YOUR_PROJECT.supabase.co/functions/v1/on-new-load`
- **HTTP Headers:** `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`

Replace `YOUR_PROJECT` and `YOUR_SERVICE_ROLE_KEY` with your project ref and service role key.
