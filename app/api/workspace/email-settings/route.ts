import { NextRequest, NextResponse } from 'next/server'
import { getRequestWorkspace } from '@/lib/api/auth-workspace'
import { getWorkspaceEmailSettings, updateWorkspaceEmailSettings } from '@/lib/services/email/dispatcher'

export async function GET() {
  const { user, workspace } = await getRequestWorkspace()
  if (!user || !workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await getWorkspaceEmailSettings(workspace.id)
  return NextResponse.json({ settings })
}

export async function PUT(req: NextRequest) {
  const { user, workspace } = await getRequestWorkspace()
  if (!user || !workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as {
    provider?: string
    fallback_provider?: string | null
    default_from_name?: string | null
    default_from_email?: string | null
    default_reply_to?: string | null
    email_core_enabled?: boolean
    email_recovery_enabled?: boolean
    email_campaigns_enabled?: boolean
    marketing_requires_consent?: boolean
  }

  const settings = await updateWorkspaceEmailSettings(workspace.id, {
    provider: body.provider,
    fallback_provider: body.fallback_provider ?? null,
    default_from_name: body.default_from_name ?? null,
    default_from_email: body.default_from_email ?? null,
    default_reply_to: body.default_reply_to ?? null,
    email_core_enabled: body.email_core_enabled,
    email_recovery_enabled: body.email_recovery_enabled,
    email_campaigns_enabled: body.email_campaigns_enabled,
    marketing_requires_consent: body.marketing_requires_consent,
  })

  return NextResponse.json({ settings })
}
