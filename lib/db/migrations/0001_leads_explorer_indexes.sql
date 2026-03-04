-- Leads explorer indexes (phase: leads redesign)
CREATE INDEX IF NOT EXISTS "leads_workspace_created_at_idx" ON "leads" ("workspace_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "leads_workspace_status_idx" ON "leads" ("workspace_id", "status");
CREATE INDEX IF NOT EXISTS "leads_workspace_form_idx" ON "leads" ("workspace_id", "form_id");
CREATE INDEX IF NOT EXISTS "leads_workspace_utm_source_idx" ON "leads" ("workspace_id", "utm_source");
CREATE INDEX IF NOT EXISTS "leads_workspace_score_idx" ON "leads" ("workspace_id", "score");
