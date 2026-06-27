-- ============================================================
--  Vaulta — Driver Portal, Phase 6 (admin review)
--  Run in Supabase SQL Editor AFTER driver_portal_phase1.sql.
--
--  Adds review tracking to the profile edit history so admins can mark
--  driver-submitted changes as reviewed (and surface an unreviewed
--  indicator). Document verify/reject already uses the status/verified_by/
--  verified_at columns from phase 1, and admins already have full RLS access
--  to driver_documents and driver_profile_edits — no new policies needed.
-- ============================================================

ALTER TABLE public.driver_profile_edits
  ADD COLUMN IF NOT EXISTS reviewed    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- Index the common "what still needs my attention" lookup.
CREATE INDEX IF NOT EXISTS driver_profile_edits_unreviewed_idx
  ON public.driver_profile_edits (workspace_id)
  WHERE reviewed = false AND reverted = false;
