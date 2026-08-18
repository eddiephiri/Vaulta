-- Add valid_sms_senders column to vehicles table
ALTER TABLE vehicles ADD COLUMN valid_sms_senders text[] DEFAULT '{}'::text[];

-- Update RLS policies (none needed explicitly for this column since it inherits from table policies)
