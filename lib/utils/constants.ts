export const APP_NAME = 'LeadForm'
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export const LEAD_STATUSES = [
  { value: 'new', label: 'Novo', color: 'bg-blue-500' },
  { value: 'contacted', label: 'Contatado', color: 'bg-yellow-500' },
  { value: 'qualified', label: 'Qualificado', color: 'bg-purple-500' },
  { value: 'converted', label: 'Convertido', color: 'bg-green-500' },
  { value: 'lost', label: 'Perdido', color: 'bg-red-500' },
] as const

export const FIELD_TYPES = [
  { type: 'text', label: 'Texto' },
  { type: 'email', label: 'E-mail' },
  { type: 'phone', label: 'Telefone' },
  { type: 'textarea', label: 'Texto longo' },
  { type: 'select', label: 'Lista suspensa' },
  { type: 'radio', label: 'Múltipla escolha' },
  { type: 'checkbox', label: 'Caixa de seleção' },
  { type: 'date', label: 'Data' },
  { type: 'hidden', label: 'Campo oculto' },
] as const

export const WEBHOOK_TYPES = [
  { type: 'generic', label: 'Genérico (HTTP)' },
  { type: 'n8n', label: 'n8n' },
  { type: 'evolution_api', label: 'Evolution API (WhatsApp)' },
  { type: 'google_sheets', label: 'Google Sheets' },
  { type: 'pipedrive', label: 'Pipedrive' },
  { type: 'hubspot', label: 'HubSpot' },
] as const

export const ROUTING_OPERATORS = [
  { value: 'equals', label: 'igual a' },
  { value: 'not_equals', label: 'diferente de' },
  { value: 'contains', label: 'contém' },
  { value: 'starts_with', label: 'começa com' },
  { value: 'greater_than', label: 'maior que' },
  { value: 'less_than', label: 'menor que' },
] as const

export const SCORE_THRESHOLDS = {
  hot: 70,
  warm: 40,
  cold: 0,
} as const
