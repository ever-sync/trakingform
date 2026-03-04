import { pgTable, text, uuid, jsonb, integer, boolean, timestamp, real, pgEnum } from 'drizzle-orm/pg-core'

// Enums
export const memberRoleEnum = pgEnum('member_role', ['owner', 'admin', 'editor', 'viewer'])
export const leadStatusEnum = pgEnum('lead_status', ['new', 'contacted', 'qualified', 'converted', 'lost'])
export const fieldTypeEnum = pgEnum('field_type', ['text', 'email', 'phone', 'select', 'checkbox', 'radio', 'date', 'textarea', 'hidden'])
export const webhookTypeEnum = pgEnum('webhook_type', ['generic', 'n8n', 'evolution_api', 'google_sheets', 'pipedrive', 'hubspot'])
export const planEnum = pgEnum('plan', ['starter', 'pro', 'agency'])

// Workspaces (multi-tenant root)
export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logo_url: text('logo_url'),
  custom_domain: text('custom_domain'),
  plan: planEnum('plan').default('starter'),
  stripe_customer_id: text('stripe_customer_id'),
  stripe_subscription_id: text('stripe_subscription_id'),
  leads_used_this_month: integer('leads_used_this_month').default(0),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
})

// Workspace members
export const workspaceMembers = pgTable('workspace_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').notNull(),
  email: text('email').notNull(),
  role: memberRoleEnum('role').default('editor'),
  invited_at: timestamp('invited_at').defaultNow(),
  accepted_at: timestamp('accepted_at'),
})

// Forms
export const forms = pgTable('forms', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  fields: jsonb('fields').notNull().default([]),
  settings: jsonb('settings').notNull().default({}),
  allowed_domains: text('allowed_domains').array().default([]),
  is_active: boolean('is_active').default(true),
  submit_redirect_url: text('submit_redirect_url'),
  submit_message: text('submit_message').default('Obrigado! Recebemos suas informações.'),
  theme: jsonb('theme').default({}),
  total_views: integer('total_views').default(0),
  total_submissions: integer('total_submissions').default(0),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
})

// Leads
export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  form_id: uuid('form_id').references(() => forms.id, { onDelete: 'set null' }),
  data: jsonb('data').notNull().default({}),
  status: leadStatusEnum('status').default('new'),
  score: integer('score').default(0),
  tags: text('tags').array().default([]),
  notes: text('notes'),
  ip_address: text('ip_address'),
  fingerprint: text('fingerprint'),
  is_duplicate: boolean('is_duplicate').default(false),
  duplicate_of: uuid('duplicate_of'),
  time_to_complete_seconds: integer('time_to_complete_seconds'),
  utm_source: text('utm_source'),
  utm_medium: text('utm_medium'),
  utm_campaign: text('utm_campaign'),
  utm_term: text('utm_term'),
  utm_content: text('utm_content'),
  referrer: text('referrer'),
  variant_id: uuid('variant_id'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
})

// WhatsApp notification configs
export const whatsappConfigs = pgTable('whatsapp_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }).unique(),
  instance_name: text('instance_name').notNull(),
  api_url: text('api_url').notNull(),
  api_key: text('api_key').notNull(),
  notify_number: text('notify_number').notNull(),
  min_score: integer('min_score').default(70),
  is_active: boolean('is_active').default(true),
  message_template: text('message_template').default('🔥 Novo lead quente! {{name}} ({{email}}) - Score: {{score}}'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
})

// A/B test form variants
export const formVariants = pgTable('form_variants', {
  id: uuid('id').primaryKey().defaultRandom(),
  form_id: uuid('form_id').references(() => forms.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  fields: jsonb('fields').notNull().default([]),
  settings: jsonb('settings').notNull().default({}),
  theme: jsonb('theme').default({}),
  weight: integer('weight').default(50),
  total_views: integer('total_views').default(0),
  total_submissions: integer('total_submissions').default(0),
  is_active: boolean('is_active').default(true),
  created_at: timestamp('created_at').defaultNow(),
})

// Lead IP enrichment data
export const leadEnrichments = pgTable('lead_enrichments', {
  id: uuid('id').primaryKey().defaultRandom(),
  lead_id: uuid('lead_id').references(() => leads.id, { onDelete: 'cascade' }).unique(),
  ip: text('ip'),
  city: text('city'),
  region: text('region'),
  country: text('country'),
  country_code: text('country_code'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  timezone: text('timezone'),
  isp: text('isp'),
  org: text('org'),
  is_vpn: boolean('is_vpn').default(false),
  is_proxy: boolean('is_proxy').default(false),
  is_hosting: boolean('is_hosting').default(false),
  browser: text('browser'),
  browser_version: text('browser_version'),
  os: text('os'),
  device_type: text('device_type'),
  is_mobile: boolean('is_mobile').default(false),
  language: text('language'),
  raw: jsonb('raw'),
  created_at: timestamp('created_at').defaultNow(),
})

// Lead event timeline
export const leadEvents = pgTable('lead_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  lead_id: uuid('lead_id').references(() => leads.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  description: text('description'),
  metadata: jsonb('metadata'),
  created_at: timestamp('created_at').defaultNow(),
})

// Email templates
export const emailTemplates = pgTable('email_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  subject: text('subject').notNull(),
  blocks: jsonb('blocks').notNull().default([]),
  from_name: text('from_name'),
  from_email: text('from_email'),
  reply_to: text('reply_to'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
})

// Email campaigns
export const emailCampaigns = pgTable('email_campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  template_id: uuid('template_id').references(() => emailTemplates.id),
  name: text('name').notNull(),
  status: text('status').default('draft'),
  total_recipients: integer('total_recipients').default(0),
  sent_count: integer('sent_count').default(0),
  opened_count: integer('opened_count').default(0),
  clicked_count: integer('clicked_count').default(0),
  bounced_count: integer('bounced_count').default(0),
  scheduled_at: timestamp('scheduled_at'),
  sent_at: timestamp('sent_at'),
  created_at: timestamp('created_at').defaultNow(),
})

// Email deliveries (per lead)
export const emailDeliveries = pgTable('email_deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaign_id: uuid('campaign_id').references(() => emailCampaigns.id, { onDelete: 'cascade' }),
  lead_id: uuid('lead_id').references(() => leads.id),
  email: text('email').notNull(),
  status: text('status').default('pending'),
  resend_id: text('resend_id'),
  opened_at: timestamp('opened_at'),
  clicked_at: timestamp('clicked_at'),
  error: text('error'),
  sent_at: timestamp('sent_at'),
})

// Webhook destinations
export const webhookDestinations = pgTable('webhook_destinations', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: webhookTypeEnum('type').default('generic'),
  url: text('url').notNull(),
  method: text('method').default('POST'),
  headers: jsonb('headers').default({}),
  payload_template: jsonb('payload_template'),
  is_active: boolean('is_active').default(true),
  secret: text('secret'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
})

// Webhook routing rules
export const webhookRoutingRules = pgTable('webhook_routing_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_id: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  destination_id: uuid('destination_id').references(() => webhookDestinations.id, { onDelete: 'cascade' }),
  form_id: uuid('form_id').references(() => forms.id),
  conditions: jsonb('conditions').default([]),
  is_active: boolean('is_active').default(true),
  priority: integer('priority').default(0),
})

// Webhook delivery logs
export const webhookLogs = pgTable('webhook_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  destination_id: uuid('destination_id').references(() => webhookDestinations.id),
  lead_id: uuid('lead_id').references(() => leads.id),
  payload: jsonb('payload'),
  status_code: integer('status_code'),
  response_body: text('response_body'),
  error: text('error'),
  attempt: integer('attempt').default(1),
  latency_ms: integer('latency_ms'),
  success: boolean('success').default(false),
  created_at: timestamp('created_at').defaultNow(),
})
