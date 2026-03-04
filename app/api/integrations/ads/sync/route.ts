import { NextRequest, NextResponse } from 'next/server'
import { processPendingAdDispatches } from '@/lib/services/ads/dispatcher'
import { getRequestWorkspace } from '@/lib/api/auth-workspace'

export async function POST(req: NextRequest) {
  const { user, workspace } = await getRequestWorkspace()
  if (!user || !workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { limit?: number }
  const limit = Number.isFinite(body.limit) ? Math.max(1, Math.min(200, Number(body.limit))) : 50

  const result = await processPendingAdDispatches(workspace.id, limit)
  return NextResponse.json({ ok: true, ...result })
}

