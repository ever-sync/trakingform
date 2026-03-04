import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  emailCampaigns,
  emailSuppressions,
  emailTemplates,
  leadConsents,
  leads,
} from '@/lib/db/schema'
import { getRequestWorkspace } from '@/lib/api/auth-workspace'
import { EmailBlock } from '@/types'
import { enqueueEmailDispatch, getWorkspaceEmailSettings, processPendingEmailDispatches } from '@/lib/services/email/dispatcher'

function pickLeadEmail(data: unknown): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const record = data as Record<string, unknown>
  const direct = typeof record.email === 'string' ? record.email.trim() : ''
  if (direct) return direct.toLowerCase()

  for (const [key, value] of Object.entries(record)) {
    if (!key.toLowerCase().includes('email')) continue
    if (typeof value !== 'string') continue
    const candidate = value.trim().toLowerCase()
    if (candidate) return candidate
  }

  return null
}

function parseBlocks(input: unknown): EmailBlock[] {
  if (!Array.isArray(input)) return []
  return input.filter((item) => item && typeof item === 'object' && !Array.isArray(item)) as EmailBlock[]
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params

  const { user, workspace } = await getRequestWorkspace()
  if (!user || !workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as {
    processNow?: boolean
    limit?: number
  }

  const [campaign] = await db
    .select()
    .from(emailCampaigns)
    .where(and(eq(emailCampaigns.id, campaignId), eq(emailCampaigns.workspace_id, workspace.id)))
    .limit(1)

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  if (!campaign.template_id) {
    return NextResponse.json({ error: 'Campaign missing template_id' }, { status: 422 })
  }

  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(and(eq(emailTemplates.id, campaign.template_id), eq(emailTemplates.workspace_id, workspace.id)))
    .limit(1)

  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  const settings = await getWorkspaceEmailSettings(workspace.id)

  if (!settings.email_campaigns_enabled) {
    return NextResponse.json({ error: 'Campaigns are disabled for this workspace' }, { status: 403 })
  }

  const filter = campaign.audience_filter && typeof campaign.audience_filter === 'object' && !Array.isArray(campaign.audience_filter)
    ? (campaign.audience_filter as Record<string, unknown>)
    : {}

  const whereConditions = [eq(leads.workspace_id, workspace.id)]

  if (typeof filter.formId === 'string' && filter.formId) {
    whereConditions.push(eq(leads.form_id, filter.formId))
  }

  if (typeof filter.status === 'string' && filter.status) {
    whereConditions.push(eq(leads.status, filter.status as 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'))
  }

  if (typeof filter.dateFrom === 'string' && filter.dateFrom) {
    whereConditions.push(gte(leads.created_at, new Date(filter.dateFrom)))
  }

  if (typeof filter.dateTo === 'string' && filter.dateTo) {
    whereConditions.push(lte(leads.created_at, new Date(filter.dateTo)))
  }

  const maxLeads = Number.isFinite(filter.maxLeads) ? Math.max(1, Math.min(5000, Number(filter.maxLeads))) : 1000

  const leadRows = await db
    .select({
      id: leads.id,
      data: leads.data,
      created_at: leads.created_at,
    })
    .from(leads)
    .where(and(...whereConditions))
    .orderBy(desc(leads.created_at))
    .limit(maxLeads)

  const rowsWithEmail = leadRows
    .map((leadRow) => ({
      leadId: leadRow.id,
      email: pickLeadEmail(leadRow.data),
      data: leadRow.data,
    }))
    .filter((row) => !!row.email && isValidEmail(row.email)) as Array<{ leadId: string; email: string; data: unknown }>

  const uniqueByEmail = new Map<string, { leadId: string; email: string; data: unknown }>()
  for (const row of rowsWithEmail) {
    if (!uniqueByEmail.has(row.email)) {
      uniqueByEmail.set(row.email, row)
    }
  }

  let recipients = [...uniqueByEmail.values()]

  if (campaign.email_type !== 'transactional') {
    const leadIds = recipients.map((item) => item.leadId)
    const emails = recipients.map((item) => item.email)
    const requiresConsent = settings.marketing_requires_consent !== false

    const [consentRows, suppressionRows] = await Promise.all([
      !requiresConsent || leadIds.length === 0
        ? Promise.resolve([])
        : db
            .select({ lead_id: leadConsents.lead_id })
            .from(leadConsents)
            .where(and(
              eq(leadConsents.workspace_id, workspace.id),
              inArray(leadConsents.lead_id, leadIds),
              eq(leadConsents.granted, true),
            )),
      emails.length === 0
        ? Promise.resolve([])
        : db
            .select({ email: emailSuppressions.email })
            .from(emailSuppressions)
            .where(and(
              eq(emailSuppressions.workspace_id, workspace.id),
              inArray(emailSuppressions.email, emails),
              eq(emailSuppressions.is_active, true),
            )),
    ])

    const consentedLeadIds = new Set(consentRows.map((item) => item.lead_id))
    const suppressedEmails = new Set(suppressionRows.map((item) => item.email))

    recipients = recipients.filter((item) => {
      if (suppressedEmails.has(item.email)) return false
      if (!requiresConsent) return true
      return consentedLeadIds.has(item.leadId)
    })
  }

  const blocks = parseBlocks(template.blocks)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const enqueueResults = await Promise.all(
    recipients.map((recipient) => {
      const leadData = recipient.data && typeof recipient.data === 'object' && !Array.isArray(recipient.data)
        ? (recipient.data as Record<string, unknown>)
        : {}

      const name = typeof leadData.name === 'string' ? leadData.name : 'Lead'
      return enqueueEmailDispatch({
        workspaceId: workspace.id,
        leadId: recipient.leadId,
        campaignId: campaign.id,
        templateId: template.id,
        recipientEmail: recipient.email,
        subject: template.subject,
        blocks,
        variables: {
          ...Object.entries(leadData).reduce<Record<string, string>>((acc, [key, value]) => {
            if (value === null || value === undefined) return acc
            acc[key] = String(value)
            return acc
          }, {}),
          name,
          email: recipient.email,
          from_name: template.from_name ?? settings.default_from_name ?? 'TrackingForm',
          from_email: template.from_email ?? settings.default_from_email ?? '',
          reply_to: template.reply_to ?? settings.default_reply_to ?? '',
          unsubscribe_url: `${appUrl}/api/email/unsubscribe?workspace=${workspace.id}&email=${encodeURIComponent(recipient.email)}`,
        },
        triggerType: 'campaign_send',
        emailType: campaign.email_type === 'transactional' ? 'transactional' : 'marketing',
        idempotencyKey: `campaign:${campaign.id}:${recipient.leadId}:${recipient.email}`,
      })
    })
  )

  const queuedCount = enqueueResults.filter((row) => row.queued).length

  await db
    .update(emailCampaigns)
    .set({
      total_recipients: recipients.length,
      status: queuedCount > 0 ? 'sending' : 'draft',
      sent_at: body.processNow === false ? null : new Date(),
    })
    .where(eq(emailCampaigns.id, campaign.id))

  if (body.processNow === false) {
    return NextResponse.json({
      ok: true,
      queued: queuedCount,
      recipients: recipients.length,
      campaign_id: campaign.id,
    })
  }

  const processing = await processPendingEmailDispatches({
    workspaceId: workspace.id,
    limit: Number.isFinite(body.limit) ? Math.max(1, Math.min(500, Number(body.limit))) : 200,
  })

  return NextResponse.json({
    ok: true,
    queued: queuedCount,
    recipients: recipients.length,
    campaign_id: campaign.id,
    processing,
  })
}
