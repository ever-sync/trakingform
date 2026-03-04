import { db } from '@/lib/db'
import { adConversionDispatches, adConversionEvents, adPlatformConfigs, leads } from '@/lib/db/schema'
import { and, asc, eq, isNull, lt, or } from 'drizzle-orm'
import { sendGoogleEnhancedLeadConversion } from './google-enhanced-leads'
import { sendMetaLeadEvent } from './meta-capi'

function mapStageToEvent(stage: string) {
  switch (stage) {
    case 'qualified':
      return 'qualified_lead'
    case 'converted':
      return 'purchase'
    case 'lost':
      return 'lost_lead'
    case 'contacted':
      return 'contacted_lead'
    default:
      return 'lead'
  }
}

export async function queueAdConversionEvent(input: {
  workspaceId: string
  leadId: string
  platform: 'google_ads' | 'meta_ads'
  stage: string
  payload?: Record<string, unknown>
}) {
  const eventName = mapStageToEvent(input.stage)
  const idempotency = `${input.platform}:${input.leadId}:${eventName}`

  const existing = await db
    .select({ id: adConversionEvents.id })
    .from(adConversionEvents)
    .where(eq(adConversionEvents.event_idempotency_key, idempotency))
    .limit(1)

  if (existing[0]) {
    return { queued: false, reason: 'already_exists' }
  }

  const [event] = await db
    .insert(adConversionEvents)
    .values({
      workspace_id: input.workspaceId,
      lead_id: input.leadId,
      platform: input.platform,
      event_name: eventName,
      event_idempotency_key: idempotency,
      payload: input.payload ?? {},
    })
    .returning({ id: adConversionEvents.id, event_name: adConversionEvents.event_name })

  await db.insert(adConversionDispatches).values({
    workspace_id: input.workspaceId,
    lead_id: input.leadId,
    event_id: event.id,
    platform: input.platform,
    event_name: event.event_name,
    status: 'pending',
    attempts: 0,
  })

  return { queued: true, eventId: event.id }
}

export async function processPendingAdDispatches(workspaceId?: string, limit = 50) {
  const whereConditions = [
    or(eq(adConversionDispatches.status, 'pending'), eq(adConversionDispatches.status, 'retrying')),
    or(isNull(adConversionDispatches.sent_at), lt(adConversionDispatches.attempts, 5)),
  ]
  if (workspaceId) {
    whereConditions.push(eq(adConversionDispatches.workspace_id, workspaceId))
  }

  const pending = await db
    .select({
      dispatch: adConversionDispatches,
      event: adConversionEvents,
      config: adPlatformConfigs,
      lead: leads,
    })
    .from(adConversionDispatches)
    .leftJoin(adConversionEvents, eq(adConversionDispatches.event_id, adConversionEvents.id))
    .leftJoin(adPlatformConfigs, and(
      eq(adPlatformConfigs.workspace_id, adConversionDispatches.workspace_id),
      eq(adPlatformConfigs.platform, adConversionDispatches.platform)
    ))
    .leftJoin(leads, eq(adConversionDispatches.lead_id, leads.id))
    .where(and(...whereConditions))
    .orderBy(asc(adConversionDispatches.created_at))
    .limit(limit)

  const results: Array<{ id: string; status: string; error?: string | null }> = []

  for (const row of pending) {
    const dispatch = row.dispatch
    const event = row.event
    const config = row.config
    const lead = row.lead

    if (!event || !config || !config.is_active || !lead) {
      await db
        .update(adConversionDispatches)
        .set({
          status: 'skipped',
          error: 'Missing event/config/lead',
          last_attempt_at: new Date(),
        })
        .where(eq(adConversionDispatches.id, dispatch.id))
      results.push({ id: dispatch.id, status: 'skipped', error: 'Missing event/config/lead' })
      continue
    }

    const leadData = (lead.data && typeof lead.data === 'object' && !Array.isArray(lead.data))
      ? lead.data as Record<string, unknown>
      : {}

    const email = typeof leadData.email === 'string' ? leadData.email : null
    const phone = typeof leadData.phone === 'string' ? leadData.phone : null

    try {
      const response = dispatch.platform === 'google_ads'
        ? await sendGoogleEnhancedLeadConversion({
            credentials: (config.credentials as Record<string, unknown>) ?? {},
            eventName: event.event_name,
            leadId: dispatch.lead_id ?? '',
            eventTime: (event.event_time ?? new Date()).toISOString(),
            email,
            phone,
            metadata: (event.payload as Record<string, unknown>) ?? {},
          })
        : await sendMetaLeadEvent({
            credentials: (config.credentials as Record<string, unknown>) ?? {},
            eventName: event.event_name,
            leadId: dispatch.lead_id ?? '',
            eventTime: (event.event_time ?? new Date()).toISOString(),
            email,
            phone,
            metadata: (event.payload as Record<string, unknown>) ?? {},
          })

      await db
        .update(adConversionDispatches)
        .set({
          status: 'sent',
          attempts: (dispatch.attempts ?? 0) + 1,
          sent_at: new Date(),
          last_attempt_at: new Date(),
          response,
          error: null,
        })
        .where(eq(adConversionDispatches.id, dispatch.id))

      results.push({ id: dispatch.id, status: 'sent' })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const attempts = (dispatch.attempts ?? 0) + 1
      await db
        .update(adConversionDispatches)
        .set({
          status: attempts >= 5 ? 'failed' : 'retrying',
          attempts,
          last_attempt_at: new Date(),
          error: message,
        })
        .where(eq(adConversionDispatches.id, dispatch.id))

      results.push({ id: dispatch.id, status: attempts >= 5 ? 'failed' : 'retrying', error: message })
    }
  }

  return {
    processed: results.length,
    sent: results.filter((item) => item.status === 'sent').length,
    failed: results.filter((item) => item.status === 'failed').length,
    retrying: results.filter((item) => item.status === 'retrying').length,
    skipped: results.filter((item) => item.status === 'skipped').length,
    results,
  }
}

