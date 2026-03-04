import { NextRequest, NextResponse } from 'next/server'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { leadRoutingRulesV2 } from '@/lib/db/schema'
import { getRequestWorkspace } from '@/lib/api/auth-workspace'

export async function GET() {
  const { user, workspace } = await getRequestWorkspace()
  if (!user || !workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rules = await db
    .select()
    .from(leadRoutingRulesV2)
    .where(eq(leadRoutingRulesV2.workspace_id, workspace.id))
    .orderBy(asc(leadRoutingRulesV2.priority), asc(leadRoutingRulesV2.created_at))

  return NextResponse.json({ rules })
}

export async function POST(req: NextRequest) {
  const { user, workspace } = await getRequestWorkspace()
  if (!user || !workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json()) as {
    id?: string
    name?: string
    is_active?: boolean
    priority?: number
    conditions?: unknown
    assignment?: unknown
    delete?: boolean
  }

  if (body.delete && body.id) {
    const [deleted] = await db
      .delete(leadRoutingRulesV2)
      .where(and(eq(leadRoutingRulesV2.id, body.id), eq(leadRoutingRulesV2.workspace_id, workspace.id)))
      .returning({ id: leadRoutingRulesV2.id })

    if (!deleted) return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    return NextResponse.json({ ok: true, id: deleted.id })
  }

  if (body.id) {
    const [updated] = await db
      .update(leadRoutingRulesV2)
      .set({
        name: body.name ?? 'Regra sem nome',
        is_active: body.is_active ?? true,
        priority: Number.isFinite(body.priority) ? Math.round(Number(body.priority)) : 0,
        conditions: Array.isArray(body.conditions) ? body.conditions : [],
        assignment: (body.assignment && typeof body.assignment === 'object' && !Array.isArray(body.assignment)) ? body.assignment : {},
        updated_at: new Date(),
      })
      .where(and(eq(leadRoutingRulesV2.id, body.id), eq(leadRoutingRulesV2.workspace_id, workspace.id)))
      .returning()

    if (!updated) return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    return NextResponse.json(updated)
  }

  const [created] = await db
    .insert(leadRoutingRulesV2)
    .values({
      workspace_id: workspace.id,
      name: body.name ?? 'Nova regra',
      is_active: body.is_active ?? true,
      priority: Number.isFinite(body.priority) ? Math.round(Number(body.priority)) : 0,
      conditions: Array.isArray(body.conditions) ? body.conditions : [],
      assignment: (body.assignment && typeof body.assignment === 'object' && !Array.isArray(body.assignment)) ? body.assignment : {},
    })
    .returning()

  return NextResponse.json(created, { status: 201 })
}

