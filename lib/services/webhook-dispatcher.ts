import { db } from '@/lib/db'
import { webhookLogs, webhookRoutingRules, webhookDestinations, leadEvents } from '@/lib/db/schema'
import { RoutingCondition } from '@/types'
import { eq, and, or, isNull, asc } from 'drizzle-orm'

type LeadData = Record<string, unknown>
type WebhookDestinationRow = typeof webhookDestinations.$inferSelect

export async function dispatchWebhooksForLead(
  leadId: string,
  formId: string,
  workspaceId: string,
  leadData: LeadData
) {
  if (!workspaceId) return

  const rows = await db
    .select({
      rule: webhookRoutingRules,
      dest: webhookDestinations,
    })
    .from(webhookRoutingRules)
    .leftJoin(webhookDestinations, eq(webhookRoutingRules.destination_id, webhookDestinations.id))
    .where(
      and(
        eq(webhookRoutingRules.workspace_id, workspaceId),
        eq(webhookRoutingRules.is_active, true),
        or(
          eq(webhookRoutingRules.form_id, formId),
          isNull(webhookRoutingRules.form_id)
        )
      )
    )
    .orderBy(asc(webhookRoutingRules.priority))

  for (const { rule, dest } of rows) {
    if (!dest?.is_active) continue
    if (!evaluateConditions(parseConditions(rule.conditions), leadData)) continue
    sendWebhook(dest, leadId, leadData).catch(console.error)
  }
}

function parseConditions(input: unknown): RoutingCondition[] {
  if (!Array.isArray(input)) return []

  return input.filter((value): value is RoutingCondition => {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<RoutingCondition>
    return (
      typeof candidate.field === 'string' &&
      typeof candidate.operator === 'string' &&
      typeof candidate.value === 'string'
    )
  })
}

function evaluateConditions(conditions: RoutingCondition[], data: LeadData): boolean {
  if (conditions.length === 0) return true
  return conditions.every(({ field, operator, value }) => {
    const fieldValue = String(data[field] ?? '')
    switch (operator) {
      case 'equals': return fieldValue === value
      case 'contains': return fieldValue.toLowerCase().includes(value.toLowerCase())
      case 'starts_with': return fieldValue.startsWith(value)
      case 'greater_than': return Number(fieldValue) > Number(value)
      case 'less_than': return Number(fieldValue) < Number(value)
      case 'not_equals': return fieldValue !== value
      default: return true
    }
  })
}

async function sendWebhook(destination: WebhookDestinationRow, leadId: string, leadData: LeadData, attempt = 1): Promise<void> {
  const payload = renderPayloadTemplate(destination.payload_template, leadData)
  const start = Date.now()

  try {
    const res = await fetch(destination.url, {
      method: destination.method || 'POST',
      headers: { 'Content-Type': 'application/json', ...parseHeaders(destination.headers) },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    })

    const responseBody = await res.text()
    const latency = Date.now() - start

    await db.insert(webhookLogs).values({
      destination_id: destination.id,
      lead_id: leadId,
      payload,
      status_code: res.status,
      response_body: responseBody.slice(0, 2000),
      attempt,
      latency_ms: latency,
      success: res.ok,
    })

    if (!res.ok && attempt < 3) {
      await new Promise(r => setTimeout(r, attempt * 2000))
      return sendWebhook(destination, leadId, leadData, attempt + 1)
    }

    recordWebhookEvent({
      leadId,
      destination,
      success: res.ok,
      attempt,
      statusCode: res.status,
      error: res.ok ? null : `HTTP ${res.status}`,
    }).catch(console.error)
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error)
    await db.insert(webhookLogs).values({
      destination_id: destination.id,
      lead_id: leadId,
      payload,
      error: errorMessage,
      attempt,
      latency_ms: Date.now() - start,
      success: false,
    })

    if (attempt < 3) {
      await new Promise(r => setTimeout(r, attempt * 2000))
      return sendWebhook(destination, leadId, leadData, attempt + 1)
    }

    recordWebhookEvent({
      leadId,
      destination,
      success: false,
      attempt,
      error: errorMessage,
    }).catch(console.error)
  }
}

async function recordWebhookEvent({
  leadId,
  destination,
  success,
  attempt,
  statusCode,
  error,
}: {
  leadId: string
  destination: WebhookDestinationRow
  success: boolean
  attempt: number
  statusCode?: number
  error?: string | null
}) {
  await db.insert(leadEvents).values({
    lead_id: leadId,
    type: 'webhook_sent',
    description: success
      ? `Webhook enviado para ${destination.name}`
      : `Falha ao enviar webhook para ${destination.name}`,
    metadata: {
      destination_id: destination.id,
      destination_name: destination.name,
      success,
      attempt,
      status_code: statusCode ?? null,
      error: error ?? null,
    },
  })
}

function parseHeaders(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  return Object.entries(value).reduce<Record<string, string>>((acc, [key, headerValue]) => {
    if (typeof headerValue === 'string') {
      acc[key] = headerValue
    }
    return acc
  }, {})
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function renderPayloadTemplate(template: unknown, data: LeadData): unknown {
  if (!template) return data
  const str = JSON.stringify(template)
  const rendered = str.replace(/\{\{(\w+)\}\}/g, (_, key) => String(data[key] ?? ''))
  return JSON.parse(rendered)
}
