export type NormalizedEmailEventType =
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'bounced'
  | 'complained'
  | 'unknown'

export interface EmailSendRequest {
  to: string
  fromName: string
  fromEmail: string
  replyTo?: string | null
  subject: string
  html: string
  text?: string
}

export interface EmailSendResult {
  provider: string
  accepted: boolean
  messageId?: string | null
  raw?: unknown
}

export interface NormalizedEmailProviderEvent {
  provider: string
  eventType: NormalizedEmailEventType
  providerMessageId?: string | null
  recipientEmail?: string | null
  occurredAt?: string | null
  payload: unknown
}

export interface EmailProviderAdapter {
  name: string
  send(input: EmailSendRequest): Promise<EmailSendResult>
  normalizeWebhookEvents?(payload: unknown): NormalizedEmailProviderEvent[]
}
