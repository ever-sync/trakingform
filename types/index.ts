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
  created_at: string
  enrichment?: LeadEnrichment
  events?: LeadEvent[]
  score_factors?: ScoringFactor[]
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
