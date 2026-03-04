import { db } from '@/lib/db'
import { leadEvents, leadStageHistory, leads } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export type LeadLifecycleEventType =
  | 'lead_created'
  | 'lead_contacted'
  | 'lead_qualified'
  | 'lead_converted'
  | 'lead_lost'

const LEAD_STAGE_EVENT_MAP: Record<string, LeadLifecycleEventType> = {
  new: 'lead_created',
  contacted: 'lead_contacted',
  qualified: 'lead_qualified',
  converted: 'lead_converted',
  lost: 'lead_lost',
}

export async function recordLeadEvent(input: {
  leadId: string
  type: string
  description?: string
  metadata?: unknown
}) {
  await db.insert(leadEvents).values({
    lead_id: input.leadId,
    type: input.type,
    description: input.description,
    metadata: input.metadata,
  })
}

export async function updateLeadStage(input: {
  leadId: string
  workspaceId: string
  toStage: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'
  changedBy?: string | null
  metadata?: unknown
}) {
  const [current] = await db
    .select({ id: leads.id, status: leads.status })
    .from(leads)
    .where(eq(leads.id, input.leadId))
    .limit(1)

  if (!current) {
    throw new Error('Lead not found')
  }

  const now = new Date()

  const updatePayload: {
    status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'
    stage_changed_at: Date
    first_response_at?: Date
    updated_at: Date
  } = {
    status: input.toStage,
    stage_changed_at: now,
    updated_at: now,
  }

  if (input.toStage === 'contacted' && current.status === 'new') {
    updatePayload.first_response_at = now
  }

  await db
    .update(leads)
    .set(updatePayload)
    .where(eq(leads.id, input.leadId))

  await db.insert(leadStageHistory).values({
    lead_id: input.leadId,
    workspace_id: input.workspaceId,
    from_stage: current.status,
    to_stage: input.toStage,
    changed_by: input.changedBy ?? null,
    metadata: input.metadata,
    changed_at: now,
  })

  const lifecycleEvent = LEAD_STAGE_EVENT_MAP[input.toStage]
  if (lifecycleEvent) {
    await recordLeadEvent({
      leadId: input.leadId,
      type: lifecycleEvent,
      description: `Lead movido para ${input.toStage}`,
      metadata: {
        from_stage: current.status,
        to_stage: input.toStage,
        changed_by: input.changedBy ?? null,
      },
    })
  }

  return {
    previousStage: current.status,
    currentStage: input.toStage,
    changedAt: now.toISOString(),
  }
}

export function buildAttributionSnapshot(input: {
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  utm_term?: string | null
  utm_content?: string | null
  referrer?: string | null
  form_id?: string | null
  variant_id?: string | null
}) {
  return {
    utm_source: input.utm_source ?? null,
    utm_medium: input.utm_medium ?? null,
    utm_campaign: input.utm_campaign ?? null,
    utm_term: input.utm_term ?? null,
    utm_content: input.utm_content ?? null,
    referrer: input.referrer ?? null,
    form_id: input.form_id ?? null,
    variant_id: input.variant_id ?? null,
    captured_at: new Date().toISOString(),
  }
}

