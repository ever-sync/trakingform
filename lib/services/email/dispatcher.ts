import { and, asc, eq, gte, inArray, lte, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  emailCampaigns,
  emailDeliveries,
  emailDispatches,
  emailProviderEvents,
  emailSuppressions,
  formSessionDrafts,
  leadConsents,
  opsAlerts,
  workspaceEmailSettings,
} from '@/lib/db/schema'
import { EmailBlock } from '@/types'
import { recordLeadEvent } from '@/lib/services/lead-events'
import { emailProviderRegistry } from '@/lib/services/email/provider-registry'
import { NormalizedEmailProviderEvent } from '@/lib/services/email/provider'
import { renderBlocksAsText, renderEmailBlocks, replaceTemplateVariables } from '@/lib/services/email/render'

export type EmailDispatchTriggerType = 'lead_received' | 'abandoned_form_recovery' | 'campaign_send'
export type EmailDispatchType = 'transactional' | 'marketing'

interface QueueEmailDispatchInput {
  workspaceId: string
  recipientEmail: string
  subject: string
  blocks: EmailBlock[]
  variables?: Record<string, string>
  triggerType: EmailDispatchTriggerType
  emailType: EmailDispatchType
  idempotencyKey: string
  leadId?: string | null
  draftId?: string | null
  campaignId?: string | null
  templateId?: string | null
  provider?: string | null
}

interface ProcessDispatchOptions {
  workspaceId?: string
  limit?: number
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function normalizeVariables(input: unknown): Record<string, string> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  return Object.entries(input as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, value]) => {
    if (value === null || value === undefined) return acc
    acc[key] = String(value)
    return acc
  }, {})
}

function normalizeBlocks(input: unknown): EmailBlock[] {
  if (!Array.isArray(input)) return []
  return input.filter((item) => item && typeof item === 'object' && !Array.isArray(item)) as EmailBlock[]
}

function buildRetryTime(attempts: number) {
  const minutes = Math.min(60, 2 ** Math.max(0, attempts - 1))
  return new Date(Date.now() + minutes * 60_000)
}

async function ensureWorkspaceSettings(workspaceId: string) {
  const [existing] = await db
    .select()
    .from(workspaceEmailSettings)
    .where(eq(workspaceEmailSettings.workspace_id, workspaceId))
    .limit(1)

  if (existing) return existing

  const [created] = await db
    .insert(workspaceEmailSettings)
    .values({
      workspace_id: workspaceId,
      provider: 'resend',
      email_core_enabled: true,
      email_recovery_enabled: true,
      email_campaigns_enabled: true,
      marketing_requires_consent: true,
    })
    .returning()

  return created
}

async function addOpsAlert(input: {
  workspaceId: string
  title: string
  message: string
  payload?: unknown
  severity?: 'warning' | 'error' | 'critical'
}) {
  await db.insert(opsAlerts).values({
    workspace_id: input.workspaceId,
    source: 'email_dispatch',
    severity: input.severity ?? 'warning',
    title: input.title,
    message: input.message,
    payload: input.payload,
  })
}

async function isSuppressedEmail(workspaceId: string, email: string) {
  const [suppression] = await db
    .select({ id: emailSuppressions.id })
    .from(emailSuppressions)
    .where(and(
      eq(emailSuppressions.workspace_id, workspaceId),
      eq(emailSuppressions.email, normalizeEmail(email)),
      eq(emailSuppressions.is_active, true),
    ))
    .limit(1)

  return !!suppression
}

async function canSendMarketing(dispatch: typeof emailDispatches.$inferSelect, requiresConsent: boolean) {
  const blockedBySuppression = await isSuppressedEmail(dispatch.workspace_id!, dispatch.recipient_email)
  if (blockedBySuppression) return false
  if (!requiresConsent) return true

  if (!dispatch.lead_id) return false

  const [consent] = await db
    .select({ id: leadConsents.id })
    .from(leadConsents)
    .where(and(
      eq(leadConsents.workspace_id, dispatch.workspace_id!),
      eq(leadConsents.lead_id, dispatch.lead_id),
      eq(leadConsents.granted, true),
    ))
    .limit(1)

  return !!consent
}

export async function getWorkspaceEmailSettings(workspaceId: string) {
  return ensureWorkspaceSettings(workspaceId)
}

export async function updateWorkspaceEmailSettings(
  workspaceId: string,
  patch: Partial<typeof workspaceEmailSettings.$inferInsert>
) {
  await ensureWorkspaceSettings(workspaceId)

  const [updated] = await db
    .update(workspaceEmailSettings)
    .set({
      provider: patch.provider,
      fallback_provider: patch.fallback_provider,
      default_from_name: patch.default_from_name,
      default_from_email: patch.default_from_email,
      default_reply_to: patch.default_reply_to,
      email_core_enabled: patch.email_core_enabled,
      email_recovery_enabled: patch.email_recovery_enabled,
      email_campaigns_enabled: patch.email_campaigns_enabled,
      marketing_requires_consent: patch.marketing_requires_consent,
      updated_at: new Date(),
    })
    .where(eq(workspaceEmailSettings.workspace_id, workspaceId))
    .returning()

  return updated
}

export async function enqueueEmailDispatch(input: QueueEmailDispatchInput) {
  const recipientEmail = normalizeEmail(input.recipientEmail)
  if (!isValidEmail(recipientEmail)) {
    throw new Error('Invalid recipient email')
  }

  const [existing] = await db
    .select({ id: emailDispatches.id, status: emailDispatches.status })
    .from(emailDispatches)
    .where(eq(emailDispatches.idempotency_key, input.idempotencyKey))
    .limit(1)

  if (existing) {
    return { queued: false, dispatchId: existing.id, status: existing.status }
  }

  const [dispatch] = await db
    .insert(emailDispatches)
    .values({
      workspace_id: input.workspaceId,
      lead_id: input.leadId ?? null,
      draft_id: input.draftId ?? null,
      campaign_id: input.campaignId ?? null,
      template_id: input.templateId ?? null,
      trigger_type: input.triggerType,
      email_type: input.emailType,
      recipient_email: recipientEmail,
      subject: input.subject,
      blocks: input.blocks,
      variables: input.variables ?? {},
      provider: input.provider ?? 'resend',
      idempotency_key: input.idempotencyKey,
      status: 'queued',
      attempts: 0,
      next_attempt_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning({ id: emailDispatches.id, status: emailDispatches.status })

  if (input.campaignId) {
    await db.insert(emailDeliveries).values({
      campaign_id: input.campaignId,
      lead_id: input.leadId ?? null,
      dispatch_id: dispatch.id,
      email: recipientEmail,
      status: 'pending',
    })
  }

  return {
    queued: true,
    dispatchId: dispatch.id,
    status: dispatch.status,
  }
}

export async function processPendingEmailDispatches(options: ProcessDispatchOptions = {}) {
  const now = new Date()
  const limit = Number.isFinite(options.limit) ? Math.max(1, Math.min(500, Number(options.limit))) : 100

  const whereConditions = [
    or(eq(emailDispatches.status, 'queued'), eq(emailDispatches.status, 'retrying')),
    lte(emailDispatches.next_attempt_at, now),
  ]

  if (options.workspaceId) {
    whereConditions.push(eq(emailDispatches.workspace_id, options.workspaceId))
  }

  const pending = await db
    .select()
    .from(emailDispatches)
    .where(and(...whereConditions))
    .orderBy(asc(emailDispatches.created_at))
    .limit(limit)

  const result = {
    processed: 0,
    sent: 0,
    failed: 0,
    retrying: 0,
    skipped: 0,
    results: [] as Array<{ id: string; status: string; error?: string | null }>,
  }

  for (const dispatch of pending) {
    result.processed++

    const settings = await ensureWorkspaceSettings(dispatch.workspace_id!)

    const coreEnabled = settings.email_core_enabled === true
    const recoveryEnabled = settings.email_recovery_enabled === true
    const campaignsEnabled = settings.email_campaigns_enabled === true

    if (!coreEnabled || (dispatch.trigger_type === 'abandoned_form_recovery' && !recoveryEnabled) || (dispatch.trigger_type === 'campaign_send' && !campaignsEnabled)) {
      await db
        .update(emailDispatches)
        .set({ status: 'skipped', error: 'Feature disabled for workspace', updated_at: new Date() })
        .where(eq(emailDispatches.id, dispatch.id))

      result.skipped++
      result.results.push({ id: dispatch.id, status: 'skipped', error: 'Feature disabled for workspace' })
      continue
    }

    if (dispatch.email_type === 'marketing') {
      const allowed = await canSendMarketing(dispatch, settings.marketing_requires_consent !== false)
      if (!allowed) {
        await db
          .update(emailDispatches)
          .set({ status: 'skipped', error: 'Consent or suppression block', updated_at: new Date() })
          .where(eq(emailDispatches.id, dispatch.id))

        result.skipped++
        result.results.push({ id: dispatch.id, status: 'skipped', error: 'Consent or suppression block' })
        continue
      }
    }

    const variables = normalizeVariables(dispatch.variables)
    const blocks = normalizeBlocks(dispatch.blocks)

    const fromName = variables.from_name || settings.default_from_name || 'LeadForm'
    const fromEmail = variables.from_email || settings.default_from_email || ''
    const replyTo = variables.reply_to || settings.default_reply_to || null

    if (!isValidEmail(fromEmail)) {
      await db
        .update(emailDispatches)
        .set({ status: 'failed', error: 'Workspace from email not configured', updated_at: new Date() })
        .where(eq(emailDispatches.id, dispatch.id))

      await addOpsAlert({
        workspaceId: dispatch.workspace_id!,
        title: 'Falha de envio de e-mail',
        message: 'Workspace sem default_from_email valido para envio.',
        payload: { dispatchId: dispatch.id, recipient: dispatch.recipient_email },
        severity: 'error',
      })

      result.failed++
      result.results.push({ id: dispatch.id, status: 'failed', error: 'Workspace from email not configured' })
      continue
    }

    await db
      .update(emailDispatches)
      .set({
        status: 'processing',
        last_attempt_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(emailDispatches.id, dispatch.id))

    try {
      const provider = emailProviderRegistry.resolve(dispatch.provider || settings.provider)
      const response = await provider.send({
        to: dispatch.recipient_email,
        fromName,
        fromEmail,
        replyTo,
        subject: replaceTemplateVariables(dispatch.subject, variables),
        html: renderEmailBlocks(blocks, variables),
        text: renderBlocksAsText(blocks, variables),
      })

      await db
        .update(emailDispatches)
        .set({
          status: 'sent',
          attempts: (dispatch.attempts ?? 0) + 1,
          provider: provider.name,
          provider_message_id: response.messageId ?? null,
          sent_at: new Date(),
          last_attempt_at: new Date(),
          error: null,
          response: response.raw ?? {},
          updated_at: new Date(),
        })
        .where(eq(emailDispatches.id, dispatch.id))

      await db
        .update(emailDeliveries)
        .set({
          status: 'sent',
          resend_id: response.messageId ?? null,
          sent_at: new Date(),
          error: null,
        })
        .where(eq(emailDeliveries.dispatch_id, dispatch.id))

      if (dispatch.campaign_id) {
        await db
          .update(emailCampaigns)
          .set({
            sent_count: sql`${emailCampaigns.sent_count} + 1`,
            status: 'sending',
          })
          .where(eq(emailCampaigns.id, dispatch.campaign_id))
      }

      if (dispatch.lead_id) {
        await recordLeadEvent({
          leadId: dispatch.lead_id,
          type: 'email_sent',
          description: `Email enviado para ${dispatch.recipient_email}`,
          metadata: {
            trigger_type: dispatch.trigger_type,
            dispatch_id: dispatch.id,
            provider: provider.name,
          },
        })
      }

      if (dispatch.draft_id) {
        await db
          .update(formSessionDrafts)
          .set({ status: 'recovery_sent', updated_at: new Date() })
          .where(eq(formSessionDrafts.id, dispatch.draft_id))
      }

      result.sent++
      result.results.push({ id: dispatch.id, status: 'sent' })
    } catch (error) {
      const attempts = (dispatch.attempts ?? 0) + 1
      const permanentFailure = attempts >= (dispatch.max_attempts ?? 5)
      const message = error instanceof Error ? error.message : String(error)

      await db
        .update(emailDispatches)
        .set({
          status: permanentFailure ? 'failed' : 'retrying',
          attempts,
          error: message,
          next_attempt_at: permanentFailure ? null : buildRetryTime(attempts),
          last_attempt_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(emailDispatches.id, dispatch.id))

      await db
        .update(emailDeliveries)
        .set({ status: permanentFailure ? 'failed' : 'retrying', error: message })
        .where(eq(emailDeliveries.dispatch_id, dispatch.id))

      if (dispatch.lead_id) {
        await recordLeadEvent({
          leadId: dispatch.lead_id,
          type: 'email_failed',
          description: `Falha ao enviar email para ${dispatch.recipient_email}`,
          metadata: {
            trigger_type: dispatch.trigger_type,
            dispatch_id: dispatch.id,
            error: message,
            attempts,
          },
        })
      }

      if (permanentFailure) {
        await addOpsAlert({
          workspaceId: dispatch.workspace_id!,
          title: 'Falha permanente de e-mail',
          message,
          payload: {
            dispatchId: dispatch.id,
            recipient: dispatch.recipient_email,
            trigger_type: dispatch.trigger_type,
          },
          severity: 'error',
        })
      }

      if (permanentFailure) result.failed++
      else result.retrying++

      result.results.push({
        id: dispatch.id,
        status: permanentFailure ? 'failed' : 'retrying',
        error: message,
      })
    }
  }

  return result
}

export async function requeueEmailDispatches(workspaceId: string, dispatchIds?: string[]) {
  const whereConditions = [eq(emailDispatches.workspace_id, workspaceId)]

  if (Array.isArray(dispatchIds) && dispatchIds.length > 0) {
    whereConditions.push(inArray(emailDispatches.id, dispatchIds))
  } else {
    whereConditions.push(or(eq(emailDispatches.status, 'failed'), eq(emailDispatches.status, 'retrying'))!)
  }

  const rows = await db
    .update(emailDispatches)
    .set({
      status: 'queued',
      next_attempt_at: new Date(),
      error: null,
      updated_at: new Date(),
    })
    .where(and(...whereConditions))
    .returning({ id: emailDispatches.id })

  return {
    queued: rows.length,
    ids: rows.map((row) => row.id),
  }
}

export async function ingestProviderEvents(workspaceId: string | null, events: NormalizedEmailProviderEvent[]) {
  let processed = 0
  let opened = 0
  let clicked = 0
  let bounced = 0
  let complained = 0

  for (const event of events) {
    const providerMessageId = event.providerMessageId ?? null

    const [dispatch] = providerMessageId
      ? await db
          .select()
          .from(emailDispatches)
          .where(eq(emailDispatches.provider_message_id, providerMessageId))
          .limit(1)
      : []

    const resolvedWorkspaceId = dispatch?.workspace_id ?? workspaceId
    if (!resolvedWorkspaceId) continue

    await db.insert(emailProviderEvents).values({
      workspace_id: resolvedWorkspaceId,
      dispatch_id: dispatch?.id ?? null,
      provider: event.provider,
      provider_message_id: providerMessageId,
      event_type: event.eventType,
      recipient_email: event.recipientEmail ?? null,
      payload: event.payload,
      occurred_at: event.occurredAt ? new Date(event.occurredAt) : new Date(),
      created_at: new Date(),
    })

    if (dispatch?.id) {
      if (event.eventType === 'opened') {
        opened++
        await db
          .update(emailDeliveries)
          .set({ opened_at: new Date() })
          .where(eq(emailDeliveries.dispatch_id, dispatch.id))

        if (dispatch.campaign_id) {
          await db
            .update(emailCampaigns)
            .set({ opened_count: sql`${emailCampaigns.opened_count} + 1` })
            .where(eq(emailCampaigns.id, dispatch.campaign_id))
        }

        if (dispatch.lead_id) {
          await recordLeadEvent({
            leadId: dispatch.lead_id,
            type: 'email_opened',
            description: `Lead abriu e-mail (${dispatch.recipient_email})`,
            metadata: { dispatch_id: dispatch.id, provider_message_id: providerMessageId },
          })
        }
      }

      if (event.eventType === 'clicked') {
        clicked++
        await db
          .update(emailDeliveries)
          .set({ clicked_at: new Date() })
          .where(eq(emailDeliveries.dispatch_id, dispatch.id))

        if (dispatch.campaign_id) {
          await db
            .update(emailCampaigns)
            .set({ clicked_count: sql`${emailCampaigns.clicked_count} + 1` })
            .where(eq(emailCampaigns.id, dispatch.campaign_id))
        }

        if (dispatch.lead_id) {
          await recordLeadEvent({
            leadId: dispatch.lead_id,
            type: 'email_clicked',
            description: `Lead clicou no e-mail (${dispatch.recipient_email})`,
            metadata: { dispatch_id: dispatch.id, provider_message_id: providerMessageId },
          })
        }
      }

      if (event.eventType === 'bounced' || event.eventType === 'complained') {
        if (event.eventType === 'bounced') bounced++
        if (event.eventType === 'complained') complained++

        await db
          .update(emailDispatches)
          .set({ status: 'failed', error: `Provider event: ${event.eventType}`, updated_at: new Date() })
          .where(eq(emailDispatches.id, dispatch.id))

        await db
          .update(emailDeliveries)
          .set({ status: event.eventType, error: `Provider event: ${event.eventType}` })
          .where(eq(emailDeliveries.dispatch_id, dispatch.id))

        if (dispatch.campaign_id) {
          await db
            .update(emailCampaigns)
            .set({ bounced_count: sql`${emailCampaigns.bounced_count} + 1` })
            .where(eq(emailCampaigns.id, dispatch.campaign_id))
        }

        if (event.eventType === 'complained' && event.recipientEmail) {
          await db
            .insert(emailSuppressions)
            .values({
              workspace_id: resolvedWorkspaceId,
              email: normalizeEmail(event.recipientEmail),
              reason: 'complaint',
              source: 'provider',
              is_active: true,
            })
            .onConflictDoUpdate({
              target: [emailSuppressions.workspace_id, emailSuppressions.email],
              set: {
                reason: 'complaint',
                source: 'provider',
                is_active: true,
                updated_at: new Date(),
              },
            })
        }
      }
    }

    processed++
  }

  return {
    processed,
    opened,
    clicked,
    bounced,
    complained,
  }
}

export async function getEmailMetrics(workspaceId: string) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const dispatchRows = await db
    .select({
      status: emailDispatches.status,
      error: emailDispatches.error,
    })
    .from(emailDispatches)
    .where(and(eq(emailDispatches.workspace_id, workspaceId), gte(emailDispatches.created_at, since)))

  const providerRows = await db
    .select({ event_type: emailProviderEvents.event_type })
    .from(emailProviderEvents)
    .where(and(eq(emailProviderEvents.workspace_id, workspaceId), gte(emailProviderEvents.created_at, since)))

  const total = dispatchRows.length
  const sent = dispatchRows.filter((row) => row.status === 'sent').length
  const failed = dispatchRows.filter((row) => row.status === 'failed').length
  const retrying = dispatchRows.filter((row) => row.status === 'retrying').length
  const queued = dispatchRows.filter((row) => row.status === 'queued' || row.status === 'processing').length

  const opened = providerRows.filter((row) => row.event_type === 'opened').length
  const clicked = providerRows.filter((row) => row.event_type === 'clicked').length
  const bounced = providerRows.filter((row) => row.event_type === 'bounced').length
  const complained = providerRows.filter((row) => row.event_type === 'complained').length

  const errorMap = dispatchRows.reduce<Record<string, number>>((acc, row) => {
    if (!row.error) return acc
    acc[row.error] = (acc[row.error] ?? 0) + 1
    return acc
  }, {})

  const topErrors = Object.entries(errorMap)
    .map(([error, count]) => ({ error, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return {
    window_days: 30,
    totals: {
      total,
      sent,
      failed,
      retrying,
      queued,
    },
    rates: {
      success_rate: total > 0 ? Number(((sent / total) * 100).toFixed(2)) : 0,
      failure_rate: total > 0 ? Number(((failed / total) * 100).toFixed(2)) : 0,
      open_rate: sent > 0 ? Number(((opened / sent) * 100).toFixed(2)) : 0,
      click_rate: sent > 0 ? Number(((clicked / sent) * 100).toFixed(2)) : 0,
      bounce_rate: sent > 0 ? Number(((bounced / sent) * 100).toFixed(2)) : 0,
      complaint_rate: sent > 0 ? Number(((complained / sent) * 100).toFixed(2)) : 0,
    },
    events: {
      opened,
      clicked,
      bounced,
      complained,
    },
    top_errors: topErrors,
  }
}
