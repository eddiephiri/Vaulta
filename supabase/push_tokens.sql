-- ============================================================
--  Vaulta — Push Notification Tokens
--  Run in Supabase SQL Editor. Stores FCM registration tokens so the
--  reminder sender (a service-role edge function) can push to each device.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token        text NOT NULL UNIQUE,
  platform     text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_tokens_user_id_idx ON public.push_tokens (user_id);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Each user (admin or driver) manages only their own device tokens. The sender
-- runs with the service role and bypasses RLS to read every token.
DROP POLICY IF EXISTS "Users manage own push tokens" ON public.push_tokens;
CREATE POLICY "Users manage own push tokens"
ON public.push_tokens
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
