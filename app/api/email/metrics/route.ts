import { NextResponse } from 'next/server'
import { getRequestWorkspace } from '@/lib/api/auth-workspace'
import { getEmailMetrics } from '@/lib/services/email/dispatcher'

export async function GET() {
  const { user, workspace } = await getRequestWorkspace()
  if (!user || !workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const metrics = await getEmailMetrics(workspace.id)
  return NextResponse.json({ metrics })
}
