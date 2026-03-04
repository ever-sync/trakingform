import { WebhookTemplate } from '@/types'

export const webhookTemplates: WebhookTemplate[] = [
  {
    name: 'Google Sheets',
    type: 'google_sheets',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    payload_template: null,
    instructions: 'Use com Google Apps Script ou n8n. Configure a URL do seu Web App publicado.',
    icon: 'table',
  },
  {
    name: 'n8n',
    type: 'n8n',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    payload_template: null,
    instructions: 'Crie um workflow n8n com trigger Webhook e cole a URL aqui.',
    icon: 'workflow',
  },
  {
    name: 'Pipedrive',
    type: 'pipedrive',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    payload_template: {
      name: '{{name}}',
      email: '{{email}}',
      phone: '{{phone}}',
      source: 'LeadForm',
    },
    instructions: 'Use a API de Pessoas do Pipedrive. URL: https://api.pipedrive.com/v1/persons?api_token=SEU_TOKEN',
    icon: 'funnel',
  },
  {
    name: 'HubSpot',
    type: 'hubspot',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer SEU_TOKEN',
    },
    payload_template: {
      properties: {
        email: '{{email}}',
        firstname: '{{name}}',
        phone: '{{phone}}',
        lifecyclestage: 'lead',
      },
    },
    instructions: 'Use a API de Contatos do HubSpot. URL: https://api.hubapi.com/crm/v3/objects/contacts',
    icon: 'hub',
  },
  {
    name: 'Slack',
    type: 'generic',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    payload_template: {
      text: 'Novo lead: {{name}} ({{email}}) - Score: {{score}}',
    },
    instructions: 'Crie um Incoming Webhook no Slack e cole a URL aqui.',
    icon: 'message',
  },
  {
    name: 'Webhook generico',
    type: 'generic',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    payload_template: null,
    instructions: 'Envia todos os dados do lead como JSON para a URL configurada.',
    icon: 'globe',
  },
]
