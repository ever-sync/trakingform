export async function sendMetaLeadEvent(input: {
  credentials: Record<string, unknown>
  eventName: string
  leadId: string
  eventTime: string
  email?: string | null
  phone?: string | null
  metadata?: Record<string, unknown>
}) {
  // Placeholder sender. Keeps payload contract stable while real CAPI credentials are configured.
  return {
    provider: 'meta_ads',
    status: 'mocked',
    payload: {
      pixel_id: input.credentials.pixel_id ?? null,
      access_token_configured: !!input.credentials.access_token,
      event_name: input.eventName,
      event_time: input.eventTime,
      event_id: `${input.leadId}:${input.eventName}`,
      user_data: {
        em: input.email ?? null,
        ph: input.phone ?? null,
      },
      custom_data: input.metadata ?? {},
    },
  }
}

