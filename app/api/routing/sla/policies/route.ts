import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { slaPolicies } from '@/lib/db/schema'
import { getRequestWorkspace } from '@/lib/api/auth-workspace'

export async function GET() {
  const { user, workspace } = await getRequestWorkspace()
  if (!user || !workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const policies = await db
    .select()
    .from(slaPolicies)
    .where(eq(slaPolicies.workspace_id, workspace.id))

  return NextResponse.json({ policies })
}

export async function POST(req: NextRequest) {
  const { user, workspace } = await getRequestWorkspace()
  if (!user || !workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json()) as {
    id?: string
    delete?: boolean
    name?: string
    is_active?: boolean
    first_response_minutes?: number
    escalation_minutes?: number
    channels?: unknown
  }

  if (body.delete && body.id) {
    const [deleted] = await db
      .delete(slaPolicies)
      .where(and(eq(slaPolicies.id, body.id), eq(slaPolicies.workspace_id, workspace.id)))
      .returning({ id: slaPolicies.id })

    if (!deleted) return NextResponse.json({ error: 'Policy not found' }, { status: 404 })
    return NextResponse.json({ ok: true, id: deleted.id })
  }

  if (body.id) {
    const [updated] = await db
      .update(slaPolicies)
      .set({
        name: body.name ?? 'SLA padrão',
        is_active: body.is_active ?? true,
        first_response_minutes: Number.isFinite(body.first_response_minutes) ? Math.max(1, Number(body.first_response_minutes)) : 15,
        escalation_minutes: Number.isFinite(body.escalation_minutes) ? Math.max(1, Number(body.escalation_minutes)) : 60,
        channels: Array.isArray(body.channels) ? body.channels : ['whatsapp'],
        updated_at: new Date(),
      })
      .where(and(eq(slaPolicies.id, body.id), eq(slaPolicies.workspace_id, workspace.id)))
      .returning()

    if (!updated) return NextResponse.json({ error: 'Policy not found' }, { status: 404 })
    return NextResponse.json(updated)
  }

  const [created] = await db
    .insert(slaPolicies)
    .values({
      workspace_id: workspace.id,
      name: body.name ?? 'SLA padrão',
      is_active: body.is_active ?? true,
      first_response_minutes: Number.isFinite(body.first_response_minutes) ? Math.max(1, Number(body.first_response_minutes)) : 15,
      escalation_minutes: Number.isFinite(body.escalation_minutes) ? Math.max(1, Number(body.escalation_minutes)) : 60,
      channels: Array.isArray(body.channels) ? body.channels : ['whatsapp'],
    })
    .returning()

  return NextResponse.json(created, { status: 201 })
}
