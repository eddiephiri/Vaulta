-- ============================================================
--  Vaulta — Scheduled Reminder Sender (cashing/salary-week alerts)
--  Run in Supabase SQL Editor AFTER deploying the send-reminders edge
--  function and setting the FIREBASE_SERVICE_ACCOUNT secret.
--
--  Adds a dedupe column and a daily pg_cron job that calls the
--  send-reminders function. The function pushes a reminder to each active
--  driver whose vehicle has a pending cashing due tomorrow.
-- ============================================================

-- 1. Dedupe: one reminder per expected cashing.
ALTER TABLE public.expected_cashings
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

-- 2. Extensions for scheduling + outbound HTTP.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 3. Store the service-role key in Vault so it isn't kept in plaintext in the
--    cron job definition. REPLACE <SERVICE_ROLE_KEY> with your project's
--    service_role key (Dashboard → Project Settings → API). Run once.
--    Re-running create_secret with the same name errors — that's fine, skip it.
SELECT vault.create_secret('<SERVICE_ROLE_KEY>', 'reminder_service_role_key');

-- 4. (Re)schedule the daily job. 04:00 UTC = 06:00 in Zambia (UTC+2),
--    i.e. the morning before a cashing that's due "tomorrow".
DO $$ BEGIN PERFORM cron.unschedule('send-reminders-daily'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'send-reminders-daily',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://yixttmmusjjamuerscja.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'reminder_service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- To send immediately for a manual test (instead of waiting for 04:00 UTC):
--   SELECT net.http_post(
--     url := 'https://yixttmmusjjamuerscja.supabase.co/functions/v1/send-reminders',
--     headers := jsonb_build_object('Content-Type','application/json',
--       'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='reminder_service_role_key')),
--     body := '{}'::jsonb
--   );
