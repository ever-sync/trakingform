import { NextRequest, NextResponse } from 'next/server'
import { emailProviderRegistry } from '@/lib/services/email/provider-registry'
import { ingestProviderEvents } from '@/lib/services/email/dispatcher'

export async function POST(req: NextRequest) {
  const expectedSecret = process.env.RESEND_WEBHOOK_SECRET
  if (expectedSecret) {
    const token = req.headers.get('x-webhook-secret')
    if (!token || token !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized webhook' }, { status: 401 })
    }
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })

  const workspaceId = req.nextUrl.searchParams.get('workspaceId')
  const provider = emailProviderRegistry.resolve('resend')
  const events = provider.normalizeWebhookEvents ? provider.normalizeWebhookEvents(body) : []

  const result = await ingestProviderEvents(workspaceId, events)
  return NextResponse.json({ ok: true, ...result })
}
