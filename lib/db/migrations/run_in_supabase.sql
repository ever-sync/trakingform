-- ============================================================
-- SAFE MIGRATION: Run this in Supabase SQL Editor
-- All statements use IF NOT EXISTS / IF EXISTS Ã¢â‚¬â€ safe to re-run
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

-- ============================================================
-- Email platform foundation (dispatch queue + provider events)
-- ============================================================
ALTER TABLE "email_campaigns" ADD COLUMN IF NOT EXISTS "email_type" text DEFAULT 'marketing';
ALTER TABLE "email_campaigns" ADD COLUMN IF NOT EXISTS "audience_filter" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "email_deliveries" ADD COLUMN IF NOT EXISTS "dispatch_id" uuid;

CREATE TABLE IF NOT EXISTS "workspace_email_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid,
  "provider" text DEFAULT 'resend',
  "fallback_provider" text,
  "default_from_name" text,
  "default_from_email" text,
  "default_reply_to" text,
  "email_core_enabled" boolean DEFAULT true,
  "email_recovery_enabled" boolean DEFAULT true,
  "email_campaigns_enabled" boolean DEFAULT true,
  "marketing_requires_consent" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "email_dispatches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid,
  "lead_id" uuid,
  "draft_id" uuid,
  "campaign_id" uuid,
  "template_id" uuid,
  "trigger_type" text DEFAULT 'lead_received' NOT NULL,
  "email_type" text DEFAULT 'transactional' NOT NULL,
  "recipient_email" text NOT NULL,
  "subject" text NOT NULL,
  "blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "variables" jsonb DEFAULT '{}'::jsonb,
  "provider" text DEFAULT 'resend',
  "provider_message_id" text,
  "idempotency_key" text NOT NULL,
  "status" text DEFAULT 'queued' NOT NULL,
  "attempts" integer DEFAULT 0,
  "max_attempts" integer DEFAULT 5,
  "next_attempt_at" timestamp DEFAULT now(),
  "last_attempt_at" timestamp,
  "sent_at" timestamp,
  "error" text,
  "response" jsonb,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "email_dispatches_idempotency_key_unique" UNIQUE("idempotency_key")
);

CREATE TABLE IF NOT EXISTS "email_provider_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid,
  "dispatch_id" uuid,
  "provider" text DEFAULT 'resend' NOT NULL,
  "provider_message_id" text,
  "event_type" text NOT NULL,
  "recipient_email" text,
  "payload" jsonb,
  "occurred_at" timestamp DEFAULT now(),
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "email_suppressions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid,
  "email" text NOT NULL,
  "reason" text DEFAULT 'unsubscribe',
  "source" text DEFAULT 'user',
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

DO $$ BEGIN ALTER TABLE "workspace_email_settings" ADD CONSTRAINT "workspace_email_settings_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "email_dispatches" ADD CONSTRAINT "email_dispatches_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "email_dispatches" ADD CONSTRAINT "email_dispatches_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "email_dispatches" ADD CONSTRAINT "email_dispatches_draft_id_fk" FOREIGN KEY ("draft_id") REFERENCES "form_session_drafts"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "email_dispatches" ADD CONSTRAINT "email_dispatches_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "email_campaigns"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "email_dispatches" ADD CONSTRAINT "email_dispatches_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "email_templates"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "email_provider_events" ADD CONSTRAINT "email_provider_events_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "email_provider_events" ADD CONSTRAINT "email_provider_events_dispatch_id_fk" FOREIGN KEY ("dispatch_id") REFERENCES "email_dispatches"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "email_suppressions" ADD CONSTRAINT "email_suppressions_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "workspace_email_settings_workspace_id_uidx" ON "workspace_email_settings" ("workspace_id");
CREATE UNIQUE INDEX IF NOT EXISTS "email_suppressions_workspace_email_uidx" ON "email_suppressions" ("workspace_id", "email");
CREATE INDEX IF NOT EXISTS "email_dispatches_workspace_status_next_idx" ON "email_dispatches" ("workspace_id", "status", "next_attempt_at");
CREATE INDEX IF NOT EXISTS "email_dispatches_provider_message_id_idx" ON "email_dispatches" ("provider_message_id");
CREATE INDEX IF NOT EXISTS "email_provider_events_workspace_event_idx" ON "email_provider_events" ("workspace_id", "event_type", "occurred_at");

