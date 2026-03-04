import { EmailBlock } from '@/types'
import { enqueueEmailDispatch, processPendingEmailDispatches } from '@/lib/services/email/dispatcher'
import { emailProviderRegistry } from '@/lib/services/email/provider-registry'
import { renderBlocksAsText, renderEmailBlocks, replaceTemplateVariables } from '@/lib/services/email/render'

export { renderEmailBlocks }

export async function sendEmailToLead({
  to,
  subject,
  blocks,
  variables,
  fromName,
  fromEmail,
  replyTo,
  workspaceId,
  leadId,
  triggerType = 'lead_received',
}: {
  to: string
  subject: string
  blocks: EmailBlock[]
  variables: Record<string, string>
  fromName: string
  fromEmail: string
  replyTo?: string | null
  workspaceId?: string
  leadId?: string | null
  triggerType?: 'lead_received' | 'abandoned_form_recovery' | 'campaign_send'
}) {
  if (workspaceId) {
    const idempotencyKey = `legacy:${workspaceId}:${to}:${triggerType}:${Date.now()}`
    const queued = await enqueueEmailDispatch({
      workspaceId,
      leadId: leadId ?? null,
      recipientEmail: to,
      subject,
      blocks,
      variables: {
        ...variables,
        from_name: fromName,
        from_email: fromEmail,
        ...(replyTo ? { reply_to: replyTo } : {}),
      },
      triggerType,
      emailType: triggerType === 'campaign_send' ? 'marketing' : 'transactional',
      idempotencyKey,
    })

    await processPendingEmailDispatches({ workspaceId, limit: 25 })
    return queued
  }

  const provider = emailProviderRegistry.getPrimary()
  return provider.send({
    to,
    fromName,
    fromEmail,
    replyTo,
    subject: replaceTemplateVariables(subject, variables),
    html: renderEmailBlocks(blocks, variables),
    text: renderBlocksAsText(blocks, variables),
  })
}
