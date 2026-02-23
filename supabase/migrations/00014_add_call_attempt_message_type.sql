-- Allow 'call_attempt' messages to log when a user taps Ara (Call) on a load
ALTER TYPE message_type ADD VALUE IF NOT EXISTS 'call_attempt';
