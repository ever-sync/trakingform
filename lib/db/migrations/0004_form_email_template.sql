-- Add email_template_id on forms
ALTER TABLE "forms" ADD COLUMN IF NOT EXISTS "email_template_id" uuid;

DO $$ BEGIN
  ALTER TABLE "forms"
  ADD CONSTRAINT "forms_email_template_id_fk"
  FOREIGN KEY ("email_template_id") REFERENCES "email_templates"("id")
  ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "forms_workspace_email_template_idx" ON "forms" ("workspace_id", "email_template_id");
