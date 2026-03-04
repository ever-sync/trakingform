import { NextRequest, NextResponse } from 'next/server'
import { getRequestWorkspace } from '@/lib/api/auth-workspace'
import { processPendingEmailDispatches, requeueEmailDispatches } from '@/lib/services/email/dispatcher'

export async function POST(req: NextRequest) {
  const { user, workspace } = await getRequestWorkspace()
  if (!user || !workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as {
    dispatchIds?: string[]
    processNow?: boolean
    limit?: number
  }

  const queued = await requeueEmailDispatches(
    workspace.id,
    Array.isArray(body.dispatchIds) ? body.dispatchIds : undefined,
  )

  if (!body.processNow) {
    return NextResponse.json({ ok: true, ...queued })
  }

  const limit = Number.isFinite(body.limit) ? Math.max(1, Math.min(500, Number(body.limit))) : 100
  const processed = await processPendingEmailDispatches({ workspaceId: workspace.id, limit })

  return NextResponse.json({ ok: true, queued, processed })
}
