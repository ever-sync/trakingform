-- ============================================================
-- SAFE MIGRATION: Run this in Supabase SQL Editor
-- All statements use IF NOT EXISTS / IF EXISTS — safe to re-run
-- ============================================================

-- Enums
DO $$ BEGIN CREATE TYPE "public"."ad_platform" AS ENUM('google_ads', 'meta_ads'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Columns that may be missing on leads
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "stage_changed_at" timestamp;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "first_response_at" timestamp;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "owner_id" uuid;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "attribution_snapshot" jsonb DEFAULT '{}'::jsonb;

-- Lead stage history
CREATE TABLE IF NOT EXISTS "lead_stage_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lead_id" uuid,
  "workspace_id" uuid,
  "from_stage" text,
  "to_stage" text NOT NULL,
  "changed_by" uuid,
  "changed_at" timestamp DEFAULT now(),
  "metadata" jsonb DEFAULT '{}'::jsonb
);

-- Ad conversion tables
CREATE TABLE IF NOT EXISTS "ad_conversion_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid,
  "lead_id" uuid,
  "platform" "ad_platform" NOT NULL,
  "event_name" text NOT NULL,
  "event_time" timestamp DEFAULT now(),
  "event_idempotency_key" text NOT NULL UNIQUE,
  "payload" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "ad_platform_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid,
  "platform" "ad_platform" NOT NULL,
  "is_active" boolean DEFAULT false,
  "credentials" jsonb DEFAULT '{}'::jsonb,
  "settings" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "ad_conversion_dispatches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid,
  "lead_id" uuid,
  "event_id" uuid,
  "platform" "ad_platform" NOT NULL,
  "event_name" text NOT NULL,
  "status" text DEFAULT 'pending',
  "attempts" integer DEFAULT 0,
  "sent_at" timestamp,
  "last_attempt_at" timestamp,
  "error" text,
  "response" jsonb,
  "created_at" timestamp DEFAULT now()
);

-- Routing v2
CREATE TABLE IF NOT EXISTS "lead_routing_rules_v2" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid,
  "name" text NOT NULL,
  "is_active" boolean DEFAULT true,
  "priority" integer DEFAULT 0,
  "conditions" jsonb DEFAULT '[]'::jsonb,
  "assignment" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "lead_assignment_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid,
  "lead_id" uuid,
  "rule_id" uuid,
  "assigned_to" uuid,
  "reason" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "sla_policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid,
  "name" text NOT NULL,
  "is_active" boolean DEFAULT true,
  "first_response_minutes" integer DEFAULT 15,
  "escalation_minutes" integer DEFAULT 60,
  "channels" jsonb DEFAULT '[]'::jsonb,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Draft/recovery tables
CREATE TABLE IF NOT EXISTS "form_session_drafts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid,
  "form_id" uuid,
  "fingerprint" text,
  "email" text,
  "phone" text,
  "data" jsonb DEFAULT '{}'::jsonb,
  "progress_step" integer DEFAULT 0,
  "resumed_at" timestamp,
  "converted_lead_id" uuid,
  "status" text DEFAULT 'active',
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "recovery_campaigns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid,
  "name" text NOT NULL,
  "is_active" boolean DEFAULT true,
  "channel" text DEFAULT 'whatsapp',
  "delay_minutes" integer DEFAULT 30,
  "message_template" text DEFAULT 'Voce quase concluiu seu cadastro. Retome por aqui: {{resume_url}}',
  "conditions" jsonb DEFAULT '[]'::jsonb,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "recovery_dispatch_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid,
  "campaign_id" uuid,
  "draft_id" uuid,
  "channel" text NOT NULL,
  "recipient" text,
  "status" text DEFAULT 'pending',
  "error" text,
  "response" jsonb,
  "sent_at" timestamp,
  "created_at" timestamp DEFAULT now()
);

-- Compliance
CREATE TABLE IF NOT EXISTS "lead_consents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid,
  "lead_id" uuid,
  "form_id" uuid,
  "consent_key" text NOT NULL,
  "consent_text" text,
  "consent_version" text DEFAULT 'v1',
  "granted" boolean DEFAULT false,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "ops_alerts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid,
  "source" text NOT NULL,
  "severity" text DEFAULT 'warning',
  "title" text NOT NULL,
  "message" text,
  "payload" jsonb,
  "is_resolved" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now(),
  "resolved_at" timestamp
);

-- Foreign keys (safe: skips if already exist)
DO $$ BEGIN ALTER TABLE "lead_stage_history" ADD CONSTRAINT "lead_stage_history_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lead_stage_history" ADD CONSTRAINT "lead_stage_history_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ad_conversion_events" ADD CONSTRAINT "ad_conversion_events_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ad_conversion_events" ADD CONSTRAINT "ad_conversion_events_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ad_platform_configs" ADD CONSTRAINT "ad_platform_configs_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ad_conversion_dispatches" ADD CONSTRAINT "ad_conversion_dispatches_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ad_conversion_dispatches" ADD CONSTRAINT "ad_conversion_dispatches_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ad_conversion_dispatches" ADD CONSTRAINT "ad_conversion_dispatches_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "ad_conversion_events"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lead_routing_rules_v2" ADD CONSTRAINT "lead_routing_rules_v2_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lead_assignment_logs" ADD CONSTRAINT "lead_assignment_logs_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lead_assignment_logs" ADD CONSTRAINT "lead_assignment_logs_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lead_assignment_logs" ADD CONSTRAINT "lead_assignment_logs_rule_id_fk" FOREIGN KEY ("rule_id") REFERENCES "lead_routing_rules_v2"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "form_session_drafts" ADD CONSTRAINT "form_session_drafts_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "form_session_drafts" ADD CONSTRAINT "form_session_drafts_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "form_session_drafts" ADD CONSTRAINT "form_session_drafts_converted_lead_id_fk" FOREIGN KEY ("converted_lead_id") REFERENCES "leads"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "recovery_campaigns" ADD CONSTRAINT "recovery_campaigns_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "recovery_dispatch_logs" ADD CONSTRAINT "recovery_dispatch_logs_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "recovery_dispatch_logs" ADD CONSTRAINT "recovery_dispatch_logs_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "recovery_campaigns"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "recovery_dispatch_logs" ADD CONSTRAINT "recovery_dispatch_logs_draft_id_fk" FOREIGN KEY ("draft_id") REFERENCES "form_session_drafts"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lead_consents" ADD CONSTRAINT "lead_consents_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lead_consents" ADD CONSTRAINT "lead_consents_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lead_consents" ADD CONSTRAINT "lead_consents_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ops_alerts" ADD CONSTRAINT "ops_alerts_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "lead_stage_history_workspace_changed_at_idx" ON "lead_stage_history" ("workspace_id", "changed_at" DESC);
CREATE INDEX IF NOT EXISTS "ad_conversion_dispatches_workspace_status_idx" ON "ad_conversion_dispatches" ("workspace_id", "status");
CREATE INDEX IF NOT EXISTS "lead_routing_rules_v2_workspace_priority_idx" ON "lead_routing_rules_v2" ("workspace_id", "priority");
CREATE INDEX IF NOT EXISTS "form_session_drafts_workspace_status_updated_idx" ON "form_session_drafts" ("workspace_id", "status", "updated_at" DESC);
CREATE INDEX IF NOT EXISTS "lead_consents_workspace_created_at_idx" ON "lead_consents" ("workspace_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "ops_alerts_workspace_resolved_idx" ON "ops_alerts" ("workspace_id", "is_resolved");
