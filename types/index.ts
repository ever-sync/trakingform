// Form types
export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[]
export type JsonObject = { [key: string]: JsonValue }

export interface FormField {
  id: string
  type: 'text' | 'email' | 'phone' | 'select' | 'checkbox' | 'radio' | 'date' | 'textarea' | 'hidden'
  name: string
  label: string
  placeholder?: string
  required: boolean
  options?: { label: string; value: string }[]
  defaultValue?: string
  helpText?: string
  validation?: {
    minLength?: number
    maxLength?: number
    pattern?: string
  }
  conditionalLogic?: {
    showIf: { field: string; operator: string; value: string }
  }
}

export interface FormSettings {
  multiStep: boolean
  steps?: { title: string; fields: string[] }[]
  showProgressBar: boolean
  allowDuplicates: boolean
  requireEmailVerification: boolean
  targetCountries?: string[]
  conversational?: boolean
  progressiveProfiling?: boolean
  abAutoWinner?: {
    enabled: boolean
    minDays: number
    minViews: number
    appliedAt?: string | null
    winnerVariantId?: string | null
    lastEvaluatedAt?: string | null
  }
}

export interface FormTheme {
  primaryColor: string
  backgroundColor: string
  textColor: string
  fontFamily: string
  borderRadius: number
  logoUrl?: string
}

// Lead types
export interface Lead {
  id: string
  workspace_id: string
  form_id: string | null
  data: JsonObject
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'
  score: number
  tags: string[]
  notes: string | null
  ip_address: string | null
  is_duplicate: boolean
  time_to_complete_seconds: number | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
  referrer: string | null
  variant_id: string | null
  stage_changed_at?: string | null
  first_response_at?: string | null
  owner_id?: string | null
  attribution_snapshot?: JsonObject | null
  created_at: string
  enrichment?: LeadEnrichment
  events?: LeadEvent[]
  score_factors?: ScoringFactor[]
}

export type LeadStage = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'

export interface LeadAttribution {
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  utm_term?: string | null
  utm_content?: string | null
  referrer?: string | null
}

export interface LeadEnrichment {
  city: string | null
  region: string | null
  country: string | null
  country_code: string | null
  latitude: number | null
  longitude: number | null
  timezone: string | null
  isp: string | null
  org: string | null
  is_vpn: boolean
  is_proxy: boolean
  browser: string | null
  os: string | null
  device_type: string | null
  is_mobile: boolean
}

export interface LeadEvent {
  id: string
  type: string
  description: string | null
  metadata: JsonValue
  created_at: string
}

export interface ScoringFactor {
  name: string
  impact: number
  description: string
}

// Email types
export interface EmailBlock {
  id: string
  type: 'header' | 'text' | 'image' | 'button' | 'divider' | 'footer'
  content?: string
  logoUrl?: string
  backgroundColor?: string
  src?: string
  alt?: string
  label?: string
  url?: string
  color?: string
  unsubscribeUrl?: string
  dividerColor?: string
  dividerThickness?: number
  dividerMargin?: number
}

export type EmailTriggerType = 'lead_received' | 'abandoned_form_recovery' | 'campaign_send'
export type EmailDispatchStatus = 'queued' | 'processing' | 'retrying' | 'sent' | 'failed' | 'skipped'

export interface EmailTemplate {
  id: string
  workspace_id: string
  name: string
  subject: string
  blocks: EmailBlock[]
  from_name: string | null
  from_email: string | null
  reply_to: string | null
  created_at: string
  updated_at: string
}

export interface EmailDispatch {
  id: string
  workspace_id: string
  lead_id: string | null
  draft_id: string | null
  campaign_id: string | null
  template_id: string | null
  trigger_type: EmailTriggerType
  email_type: 'transactional' | 'marketing'
  recipient_email: string
  subject: string
  blocks: EmailBlock[]
  variables: JsonObject
  provider: string | null
  provider_message_id: string | null
  idempotency_key: string
  status: EmailDispatchStatus
  attempts: number
  max_attempts: number
  next_attempt_at: string | null
  last_attempt_at: string | null
  sent_at: string | null
  error: string | null
  response: JsonValue
  created_at: string
  updated_at: string
}

export interface EmailProviderEvent {
  id: string
  workspace_id: string
  dispatch_id: string | null
  provider: string
  provider_message_id: string | null
  event_type: string
  recipient_email: string | null
  payload: JsonValue
  occurred_at: string | null
  created_at: string
}

export interface WorkspaceEmailSettings {
  id: string
  workspace_id: string
  provider: string | null
  fallback_provider: string | null
  default_from_name: string | null
  default_from_email: string | null
  default_reply_to: string | null
  email_core_enabled: boolean
  email_recovery_enabled: boolean
  email_campaigns_enabled: boolean
  marketing_requires_consent: boolean
}

// Webhook types
export interface WebhookDestination {
  id: string
  name: string
  type: 'generic' | 'n8n' | 'evolution_api' | 'google_sheets' | 'pipedrive' | 'hubspot'
  url: string
  method: 'POST' | 'GET' | 'PUT' | 'PATCH'
  headers: Record<string, string>
  payload_template: JsonObject | null
  is_active: boolean
}

export interface RoutingCondition {
  field: string
  operator: 'equals' | 'not_equals' | 'contains' | 'starts_with' | 'greater_than' | 'less_than'
  value: string
}

export interface RoutingRuleV2 {
  id: string
  workspace_id: string
  name: string
  is_active: boolean
  priority: number
  conditions: JsonValue
  assignment: JsonValue
  created_at: string
  updated_at: string
}

export interface SlaPolicy {
  id: string
  workspace_id: string
  name: string
  is_active: boolean
  first_response_minutes: number
  escalation_minutes: number
  channels: JsonValue
}

export interface LeadAssignment {
  id: string
  lead_id: string
  rule_id: string | null
  assigned_to: string | null
  reason: string | null
  metadata: JsonValue
  created_at: string
}

export interface WebhookLog {
  id: string
  destination_id: string
  lead_id: string
  payload: JsonValue
  status_code: number | null
  response_body: string | null
  error: string | null
  attempt: number
  latency_ms: number | null
  success: boolean
  created_at: string
}

export interface RecoveryDraft {
  id: string
  workspace_id: string
  form_id: string
  fingerprint: string | null
  email: string | null
  phone: string | null
  data: JsonObject
  progress_step: number
  resumed_at: string | null
  converted_lead_id: string | null
  status: string
  created_at: string
  updated_at: string
}

export interface RecoveryCampaign {
  id: string
  workspace_id: string
  name: string
  is_active: boolean
  channel: string
  delay_minutes: number
  message_template: string
  conditions: JsonValue
  created_at: string
  updated_at: string
}

export interface ConsentRecord {
  id: string
  workspace_id: string
  lead_id: string
  form_id: string | null
  consent_key: string
  consent_text: string | null
  consent_version: string
  granted: boolean
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export interface AdDispatchStatus {
  id: string
  workspace_id: string
  lead_id: string
  platform: 'google_ads' | 'meta_ads'
  event_name: string
  status: string
  attempts: number
  sent_at: string | null
  error: string | null
  created_at: string
}

// Webhook template types
export interface WebhookTemplate {
  name: string
  type: WebhookDestination['type']
  method: string
  headers: Record<string, string>
  payload_template: JsonObject | null
  instructions: string
  icon: string
}

// Plan types
export type Plan = 'starter' | 'pro' | 'agency'

export interface PlanLimits {
  maxForms: number
  maxLeadsPerMonth: number
  maxWorkspaces: number
  maxEmailTemplates: number
  maxWebhookDestinations: number
  hasIPEnrichment: 'basic' | 'full'
  hasLeadScoring: boolean
  hasWhiteLabel: boolean
  hasCustomDomain: boolean
  hasAPIAccess: boolean
}

// Workspace types
export interface Workspace {
  id: string
  name: string
  slug: string
  logo_url: string | null
  custom_domain: string | null
  plan: Plan
  leads_used_this_month: number
  created_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  email: string
  role: 'owner' | 'admin' | 'editor' | 'viewer'
  invited_at: string
  accepted_at: string | null
}

// Embed mode types
export type EmbedMode = 'inline' | 'popup' | 'slide-right' | 'slide-left' | 'top-bar' | 'exit-intent'
