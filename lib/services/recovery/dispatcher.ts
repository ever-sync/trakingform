import { and, eq, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { formSessionDrafts, recoveryCampaigns, recoveryDispatchLogs } from '@/lib/db/schema'
import { EmailBlock } from '@/types'
import { enqueueEmailDispatch, processPendingEmailDispatches } from '@/lib/services/email/dispatcher'

function renderTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => vars[key] ?? '')
}

function pickRecipient(channel: string, draft: typeof formSessionDrafts.$inferSelect) {
  if (channel === 'whatsapp') return draft.phone
  if (channel === 'email') return draft.email
  return draft.phone ?? draft.email
}

function buildEmailBlocks(message: string): EmailBlock[] {
  return [
    {
      id: 'recovery_text',
      type: 'text',
      content: message,
    },
  ]
}

export async function dispatchRecoveryCampaigns(workspaceId?: string) {
  const whereConditions = [eq(recoveryCampaigns.is_active, true)]
  if (workspaceId) {
    whereConditions.push(eq(recoveryCampaigns.workspace_id, workspaceId))
  }

  const campaigns = await db
    .select()
    .from(recoveryCampaigns)
    .where(and(...whereConditions))

  let sent = 0
  let queuedEmail = 0

  for (const campaign of campaigns) {
    if (!campaign.workspace_id) continue

    const cutoff = new Date(Date.now() - (campaign.delay_minutes ?? 30) * 60_000)

    const drafts = await db
      .select()
      .from(formSessionDrafts)
      .where(and(
        eq(formSessionDrafts.workspace_id, campaign.workspace_id),
        eq(formSessionDrafts.status, 'active'),
        lte(formSessionDrafts.updated_at, cutoff)
      ))
      .limit(100)

    for (const draft of drafts) {
      const recipient = pickRecipient(campaign.channel, draft)
      if (!recipient) continue

      const resumeUrl = `/embed/${draft.form_id}?resume=${draft.id}`
      const message = renderTemplate(campaign.message_template, {
        resume_url: resumeUrl,
        email: draft.email ?? '',
        phone: draft.phone ?? '',
      })

      if (campaign.channel === 'email' && draft.email) {
        const enqueueResult = await enqueueEmailDispatch({
          workspaceId: campaign.workspace_id,
          draftId: draft.id,
          recipientEmail: draft.email,
          subject: campaign.name,
          blocks: buildEmailBlocks(message),
          variables: {
            email: draft.email ?? '',
            phone: draft.phone ?? '',
            resume_url: resumeUrl,
          },
          triggerType: 'abandoned_form_recovery',
          emailType: 'transactional',
          idempotencyKey: `recovery:${campaign.id}:${draft.id}`,
        })

        await db.insert(recoveryDispatchLogs).values({
          workspace_id: campaign.workspace_id,
          campaign_id: campaign.id,
          draft_id: draft.id,
          channel: campaign.channel,
          recipient,
          status: enqueueResult.queued ? 'queued' : 'skipped',
          sent_at: enqueueResult.queued ? new Date() : null,
          response: {
            provider: 'resend_queue',
            dispatch_id: enqueueResult.dispatchId,
            queued: enqueueResult.queued,
          },
        })

        await db
          .update(formSessionDrafts)
          .set({ status: 'recovery_queued', updated_at: new Date() })
          .where(eq(formSessionDrafts.id, draft.id))

        if (enqueueResult.queued) queuedEmail++
        continue
      }

      await db.insert(recoveryDispatchLogs).values({
        workspace_id: campaign.workspace_id,
        campaign_id: campaign.id,
        draft_id: draft.id,
        channel: campaign.channel,
        recipient,
        status: 'sent',
        sent_at: new Date(),
        response: {
          provider: 'mock',
          message,
        },
      })

      await db
        .update(formSessionDrafts)
        .set({ status: 'recovery_sent', updated_at: new Date() })
        .where(eq(formSessionDrafts.id, draft.id))

      sent++
    }
  }

  if (queuedEmail > 0) {
    await processPendingEmailDispatches({ workspaceId, limit: 200 })
  }

  return {
    checkedCampaigns: campaigns.length,
    sent,
    queuedEmail,
  }
}
