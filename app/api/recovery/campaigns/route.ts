import { NextRequest, NextResponse } from 'next/server'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { recoveryCampaigns } from '@/lib/db/schema'
import { getRequestWorkspace } from '@/lib/api/auth-workspace'
import { dispatchRecoveryCampaigns } from '@/lib/services/recovery/dispatcher'

export async function GET() {
  const { user, workspace } = await getRequestWorkspace()
  if (!user || !workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const campaigns = await db
    .select()
    .from(recoveryCampaigns)
    .where(eq(recoveryCampaigns.workspace_id, workspace.id))
    .orderBy(asc(recoveryCampaigns.created_at))

  return NextResponse.json({ campaigns })
}

export async function POST(req: NextRequest) {
  const { user, workspace } = await getRequestWorkspace()
  if (!user || !workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json()) as {
    id?: string
    delete?: boolean
    run_now?: boolean
    name?: string
    is_active?: boolean
    channel?: string
    delay_minutes?: number
    message_template?: string
    conditions?: unknown
  }

  if (body.run_now) {
    const result = await dispatchRecoveryCampaigns(workspace.id)
    return NextResponse.json({ ok: true, ...result })
  }

  if (body.delete && body.id) {
    const [deleted] = await db
      .delete(recoveryCampaigns)
      .where(and(eq(recoveryCampaigns.id, body.id), eq(recoveryCampaigns.workspace_id, workspace.id)))
      .returning({ id: recoveryCampaigns.id })

    if (!deleted)
      return NextResponse.json({ error: 'Campanha não encontrada.' }, { status: 404 })
    return NextResponse.json({ ok: true, id: deleted.id })
  }

  if (body.id) {
    const [updated] = await db
      .update(recoveryCampaigns)
      .set({
        name: body.name ?? 'Campanha de recuperação',
        is_active: body.is_active ?? true,
        channel: body.channel ?? 'whatsapp',
        delay_minutes: Number.isFinite(body.delay_minutes) ? Math.max(1, Number(body.delay_minutes)) : 30,
        message_template:
          body.message_template ?? 'Você quase concluiu seu cadastro. Retome por aqui: {{resume_url}}',
        conditions: Array.isArray(body.conditions) ? body.conditions : [],
        updated_at: new Date(),
      })
      .where(and(eq(recoveryCampaigns.id, body.id), eq(recoveryCampaigns.workspace_id, workspace.id)))
      .returning()

    if (!updated)
      return NextResponse.json({ error: 'Campanha não encontrada.' }, { status: 404 })
    return NextResponse.json(updated)
  }

  const [created] = await db
    .insert(recoveryCampaigns)
    .values({
      workspace_id: workspace.id,
      name: body.name ?? 'Campanha de recuperação',
      is_active: body.is_active ?? true,
      channel: body.channel ?? 'whatsapp',
      delay_minutes: Number.isFinite(body.delay_minutes) ? Math.max(1, Number(body.delay_minutes)) : 30,
      message_template:
        body.message_template ?? 'Você quase concluiu seu cadastro. Retome por aqui: {{resume_url}}',
      conditions: Array.isArray(body.conditions) ? body.conditions : [],
    })
    .returning()

  return NextResponse.json(created, { status: 201 })
}

