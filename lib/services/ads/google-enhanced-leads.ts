function hashPlaceholder(value: string | undefined | null) {
  if (!value) return null
  return String(value).trim().toLowerCase()
}

export async function sendGoogleEnhancedLeadConversion(input: {
  credentials: Record<string, unknown>
  eventName: string
  leadId: string
  eventTime: string
  email?: string | null
  phone?: string | null
  metadata?: Record<string, unknown>
}) {
  // Placeholder sender. Stores normalized payload for audit and future adapter implementation.
  return {
    provider: 'google_ads',
    status: 'mocked',
    payload: {
      customer_id: input.credentials.customer_id ?? null,
      conversion_action: input.credentials.conversion_action ?? null,
      event_name: input.eventName,
      lead_id: input.leadId,
      event_time: input.eventTime,
      user_data: {
        email: hashPlaceholder(input.email),
        phone: hashPlaceholder(input.phone),
      },
      metadata: input.metadata ?? {},
    },
  }
}

