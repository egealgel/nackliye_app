-- Allow 'system' messages in chat (e.g. delivery confirmations)
ALTER TYPE message_type ADD VALUE IF NOT EXISTS 'system';
