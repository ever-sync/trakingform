import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import { getRequestWorkspace } from '@/lib/api/auth-workspace'
import { updateLeadStage } from '@/lib/services/lead-events'
import { queueAdConversionEvent } from '@/lib/services/ads/dispatcher'

const ALLOWED_STAGES = new Set(['new', 'contacted', 'qualified', 'converted', 'lost'])

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const { user, workspace } = await getRequestWorkspace()
  if (!user || !workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { leadId } = await params
  const body = (await req.json()) as { stage?: string; metadata?: unknown }

  if (!body.stage || !ALLOWED_STAGES.has(body.stage)) {
    return NextResponse.json({ error: 'Invalid stage' }, { status: 422 })
  }

  const [lead] = await db
    .select({ id: leads.id, workspace_id: leads.workspace_id })
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.workspace_id, workspace.id)))
    .limit(1)

  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  const result = await updateLeadStage({
    leadId,
    workspaceId: workspace.id,
    toStage: body.stage as 'new' | 'contacted' | 'qualified' | 'converted' | 'lost',
    changedBy: user.id,
    metadata: body.metadata,
  })

  if (body.stage !== 'new') {
    await Promise.allSettled([
      queueAdConversionEvent({ workspaceId: workspace.id, leadId, platform: 'google_ads', stage: body.stage }),
      queueAdConversionEvent({ workspaceId: workspace.id, leadId, platform: 'meta_ads', stage: body.stage }),
    ])
  }

  return NextResponse.json({ ok: true, ...result })
}

