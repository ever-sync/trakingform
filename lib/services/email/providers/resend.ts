import { Resend } from 'resend'
import {
  EmailProviderAdapter,
  EmailSendRequest,
  EmailSendResult,
  NormalizedEmailProviderEvent,
  NormalizedEmailEventType,
} from '@/lib/services/email/provider'

function mapResendEventType(value: string): NormalizedEmailEventType {
  const lower = value.toLowerCase()
  if (lower.includes('deliver')) return 'delivered'
  if (lower.includes('open')) return 'opened'
  if (lower.includes('click')) return 'clicked'
  if (lower.includes('bounce')) return 'bounced'
  if (lower.includes('complain')) return 'complained'
  return 'unknown'
}

function parseResendEvent(payload: Record<string, unknown>): NormalizedEmailProviderEvent {
  const type = typeof payload.type === 'string' ? payload.type : 'unknown'
  const data = payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
    ? (payload.data as Record<string, unknown>)
    : {}

  const to = Array.isArray(data.to) ? data.to[0] : data.to

  return {
    provider: 'resend',
    eventType: mapResendEventType(type),
    providerMessageId:
      typeof data.email_id === 'string'
        ? data.email_id
        : typeof data.id === 'string'
          ? data.id
          : null,
    recipientEmail: typeof to === 'string' ? to : null,
    occurredAt:
      typeof payload.created_at === 'string'
        ? payload.created_at
        : typeof data.created_at === 'string'
          ? data.created_at
          : null,
    payload,
  }
}

export class ResendAdapter implements EmailProviderAdapter {
  readonly name = 'resend'

  private getClient() {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is missing')
    }
    return new Resend(process.env.RESEND_API_KEY)
  }

  async send(input: EmailSendRequest): Promise<EmailSendResult> {
    const resend = this.getClient()

    const result = await resend.emails.send({
      from: `${input.fromName} <${input.fromEmail}>`,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo ?? undefined,
    })

    const error = (result as { error?: { message?: string } }).error
    if (error) {
      throw new Error(error.message ?? 'Resend send failed')
    }

    const data = (result as { data?: { id?: string } }).data
    return {
      provider: this.name,
      accepted: true,
      messageId: data?.id ?? null,
      raw: result,
    }
  }

  normalizeWebhookEvents(payload: unknown): NormalizedEmailProviderEvent[] {
    if (Array.isArray(payload)) {
      return payload
        .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
        .map((item) => parseResendEvent(item as Record<string, unknown>))
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return []
    }

    return [parseResendEvent(payload as Record<string, unknown>)]
  }
}
