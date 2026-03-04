-- Email platform foundation: dispatch queue, provider events, suppressions, workspace settings

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

