import { NextResponse } from 'next/server'
import { getRequestWorkspace } from '@/lib/api/auth-workspace'
import { runSlaMonitor } from '@/lib/services/routing/sla-monitor'

export async function POST() {
  const { user, workspace } = await getRequestWorkspace()
  if (!user || !workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await runSlaMonitor(workspace.id)
  return NextResponse.json({ ok: true, ...result })
}
