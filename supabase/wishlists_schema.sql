-- ─── Wishlists Table ─────────────────────────────────────────────────────────
-- Each app (transport, budget, personal) maintains its own wishlist scoped
-- to the workspace. Items track desired purchases, priority, and optionally
-- link to a transactions record when purchased.

CREATE TABLE IF NOT EXISTS wishlists (
    id                      uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id            uuid            NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    app_id                  text            NOT NULL CHECK (app_id IN ('transport', 'budget', 'personal')),
    name                    text            NOT NULL,
    description             text,
    estimated_price_zmw     numeric(14, 2)  NOT NULL DEFAULT 0,
    priority                text            NOT NULL DEFAULT 'medium'
                                            CHECK (priority IN ('low', 'medium', 'high')),
    category                text,
    status                  text            NOT NULL DEFAULT 'active'
                                            CHECK (status IN ('active', 'purchased', 'archived')),
    target_date             date,
    purchase_date           date,
    actual_price_zmw        numeric(14, 2),
    linked_transaction_id   uuid            REFERENCES transactions(id) ON DELETE SET NULL,
    notes                   text,
    created_at              timestamptz     NOT NULL DEFAULT now(),
    updated_at              timestamptz     NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_wishlists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wishlists_updated_at
    BEFORE UPDATE ON wishlists
    FOR EACH ROW EXECUTE FUNCTION update_wishlists_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;

-- Members of the workspace can read all wishlists in that workspace
CREATE POLICY "workspace_members_can_read_wishlists"
ON wishlists FOR SELECT
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_users
        WHERE user_id = auth.uid()
    )
);

-- Members with edit rights can insert
CREATE POLICY "workspace_members_can_insert_wishlists"
ON wishlists FOR INSERT
WITH CHECK (
    workspace_id IN (
        SELECT workspace_id FROM workspace_users
        WHERE user_id = auth.uid()
          AND role IN ('owner', 'admin', 'member')
    )
);

-- Members with edit rights can update
CREATE POLICY "workspace_members_can_update_wishlists"
ON wishlists FOR UPDATE
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_users
        WHERE user_id = auth.uid()
          AND role IN ('owner', 'admin', 'member')
    )
);

-- Only owners/admins can delete
CREATE POLICY "workspace_admins_can_delete_wishlists"
ON wishlists FOR DELETE
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_users
        WHERE user_id = auth.uid()
          AND role IN ('owner', 'admin')
    )
);
