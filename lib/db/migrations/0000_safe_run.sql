-- Safe migration: can be run even if types/tables already exist
-- Run this in Supabase SQL Editor

-- ENUMS (safe: skips if already exists)
DO $$ BEGIN CREATE TYPE "public"."field_type" AS ENUM('text', 'email', 'phone', 'select', 'checkbox', 'radio', 'date', 'textarea', 'hidden'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."lead_status" AS ENUM('new', 'contacted', 'qualified', 'converted', 'lost'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."member_role" AS ENUM('owner', 'admin', 'editor', 'viewer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."plan" AS ENUM('starter', 'pro', 'agency'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."webhook_type" AS ENUM('generic', 'n8n', 'evolution_api', 'google_sheets', 'pipedrive', 'hubspot'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TABLES
CREATE TABLE IF NOT EXISTS "workspaces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "logo_url" text,
  "custom_domain" text,
  "plan" "plan" DEFAULT 'starter',
  "stripe_customer_id" text,
  "stripe_subscription_id" text,
  "leads_used_this_month" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "workspaces_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "workspace_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid,
  "user_id" uuid NOT NULL,
  "email" text NOT NULL,
  "role" "member_role" DEFAULT 'editor',
  "invited_at" timestamp DEFAULT now(),
  "accepted_at" timestamp
);

CREATE TABLE IF NOT EXISTS "forms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid,
  "name" text NOT NULL,
  "description" text,
  "fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "allowed_domains" text[] DEFAULT '{}',
  "is_active" boolean DEFAULT true,
  "submit_redirect_url" text,
  "submit_message" text DEFAULT 'Obrigado! Recebemos suas informaÃƒÂ§ÃƒÂµes.',
  "theme" jsonb DEFAULT '{}'::jsonb,
  "total_views" integer DEFAULT 0,
  "total_submissions" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "leads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid,
  "form_id" uuid,
  "data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" "lead_status" DEFAULT 'new',
  "score" integer DEFAULT 0,
  "tags" text[] DEFAULT '{}',
  "notes" text,
  "ip_address" text,
  "fingerprint" text,
  "is_duplicate" boolean DEFAULT false,
  "duplicate_of" uuid,
  "time_to_complete_seconds" integer,
  "utm_source" text,
  "utm_medium" text,
  "utm_campaign" text,
  "utm_term" text,
  "utm_content" text,
  "referrer" text,
  "variant_id" uuid,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "lead_enrichments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lead_id" uuid,
  "ip" text, "city" text, "region" text, "country" text, "country_code" text,
  "latitude" real, "longitude" real, "timezone" text, "isp" text, "org" text,
  "is_vpn" boolean DEFAULT false,
  "is_proxy" boolean DEFAULT false,
  "is_hosting" boolean DEFAULT false,
  "browser" text, "browser_version" text, "os" text, "device_type" text,
  "is_mobile" boolean DEFAULT false,
  "language" text, "raw" jsonb,
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT "lead_enrichments_lead_id_unique" UNIQUE("lead_id")
);

CREATE TABLE IF NOT EXISTS "lead_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lead_id" uuid,
  "type" text NOT NULL,
  "description" text,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "email_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid,
  "name" text NOT NULL,
  "subject" text NOT NULL,
  "blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "from_name" text, "from_email" text, "reply_to" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "email_campaigns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid, "template_id" uuid,
  "name" text NOT NULL,
  "status" text DEFAULT 'draft',
  "total_recipients" integer DEFAULT 0, "sent_count" integer DEFAULT 0,
  "opened_count" integer DEFAULT 0, "clicked_count" integer DEFAULT 0,
  "bounced_count" integer DEFAULT 0,
  "scheduled_at" timestamp, "sent_at" timestamp,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "email_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid, "lead_id" uuid,
  "email" text NOT NULL,
  "status" text DEFAULT 'pending',
  "resend_id" text,
  "opened_at" timestamp, "clicked_at" timestamp,
  "error" text, "sent_at" timestamp
);

CREATE TABLE IF NOT EXISTS "webhook_destinations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid,
  "name" text NOT NULL,
  "type" "webhook_type" DEFAULT 'generic',
  "url" text NOT NULL,
  "method" text DEFAULT 'POST',
  "headers" jsonb DEFAULT '{}'::jsonb,
  "payload_template" jsonb,
  "is_active" boolean DEFAULT true,
  "secret" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "webhook_routing_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid, "destination_id" uuid, "form_id" uuid,
  "conditions" jsonb DEFAULT '[]'::jsonb,
  "is_active" boolean DEFAULT true,
  "priority" integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "webhook_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "destination_id" uuid, "lead_id" uuid,
  "payload" jsonb, "status_code" integer, "response_body" text,
  "error" text, "attempt" integer DEFAULT 1,
  "latency_ms" integer, "success" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "whatsapp_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid UNIQUE,
  "instance_name" text NOT NULL,
  "api_url" text NOT NULL,
  "api_key" text NOT NULL,
  "notify_number" text NOT NULL,
  "min_score" integer DEFAULT 70,
  "is_active" boolean DEFAULT true,
  "message_template" text DEFAULT 'Novo lead quente! {{name}} ({{email}}) - Score: {{score}}',
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "form_variants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "form_id" uuid,
  "name" text NOT NULL,
  "fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "theme" jsonb DEFAULT '{}'::jsonb,
  "weight" integer DEFAULT 50,
  "total_views" integer DEFAULT 0,
  "total_submissions" integer DEFAULT 0,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now()
);

-- FOREIGN KEYS (safe: skips if already exists)
DO $$ BEGIN ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "forms" ADD CONSTRAINT "forms_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "leads" ADD CONSTRAINT "leads_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "leads" ADD CONSTRAINT "leads_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lead_enrichments" ADD CONSTRAINT "lead_enrichments_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "email_templates"("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_campaign_id_email_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "email_campaigns"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "leads"("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "webhook_destinations" ADD CONSTRAINT "webhook_destinations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "webhook_routing_rules" ADD CONSTRAINT "webhook_routing_rules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "webhook_routing_rules" ADD CONSTRAINT "webhook_routing_rules_destination_id_webhook_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "webhook_destinations"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "webhook_routing_rules" ADD CONSTRAINT "webhook_routing_rules_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "forms"("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_destination_id_webhook_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "webhook_destinations"("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "leads"("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "whatsapp_configs" ADD CONSTRAINT "whatsapp_configs_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "form_variants" ADD CONSTRAINT "form_variants_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Compatibility columns for older databases
ALTER TABLE "forms" ADD COLUMN IF NOT EXISTS "submit_redirect_url" text;
ALTER TABLE "forms" ADD COLUMN IF NOT EXISTS "submit_message" text DEFAULT 'Obrigado! Recebemos suas informacoes.';
ALTER TABLE "forms" ADD COLUMN IF NOT EXISTS "theme" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "utm_source" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "utm_medium" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "utm_campaign" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "utm_term" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "utm_content" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "referrer" text;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "variant_id" uuid;

-- Performance indexes for leads explorer
CREATE INDEX IF NOT EXISTS "leads_workspace_created_at_idx" ON "leads" ("workspace_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "leads_workspace_status_idx" ON "leads" ("workspace_id", "status");
CREATE INDEX IF NOT EXISTS "leads_workspace_form_idx" ON "leads" ("workspace_id", "form_id");
CREATE INDEX IF NOT EXISTS "leads_workspace_utm_source_idx" ON "leads" ("workspace_id", "utm_source");
CREATE INDEX IF NOT EXISTS "leads_workspace_score_idx" ON "leads" ("workspace_id", "score");

-- New enum for ad integrations
DO $$ BEGIN CREATE TYPE "public"."ad_platform" AS ENUM('google_ads', 'meta_ads'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- New lead lifecycle columns
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "stage_changed_at" timestamp;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "first_response_at" timestamp;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "owner_id" uuid;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "attribution_snapshot" jsonb DEFAULT '{}'::jsonb;

-- New form email template column
ALTER TABLE "forms" ADD COLUMN IF NOT EXISTS "email_template_id" uuid;

-- Conversion stage history
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

-- Ad conversion events + dispatch queue
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

-- Routing v2 + SLA
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

-- Draft/recovery
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

-- Compliance + Ops
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

-- New foreign keys
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
DO $$ BEGIN ALTER TABLE "forms" ADD CONSTRAINT "forms_email_template_id_fk" FOREIGN KEY ("email_template_id") REFERENCES "email_templates"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- New indexes
CREATE INDEX IF NOT EXISTS "lead_stage_history_workspace_changed_at_idx" ON "lead_stage_history" ("workspace_id", "changed_at" DESC);
CREATE INDEX IF NOT EXISTS "ad_conversion_dispatches_workspace_status_idx" ON "ad_conversion_dispatches" ("workspace_id", "status");
CREATE INDEX IF NOT EXISTS "lead_routing_rules_v2_workspace_priority_idx" ON "lead_routing_rules_v2" ("workspace_id", "priority");
CREATE INDEX IF NOT EXISTS "form_session_drafts_workspace_status_updated_idx" ON "form_session_drafts" ("workspace_id", "status", "updated_at" DESC);
CREATE INDEX IF NOT EXISTS "lead_consents_workspace_created_at_idx" ON "lead_consents" ("workspace_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "ops_alerts_workspace_resolved_idx" ON "ops_alerts" ("workspace_id", "is_resolved");
CREATE INDEX IF NOT EXISTS "forms_workspace_email_template_idx" ON "forms" ("workspace_id", "email_template_id");

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

