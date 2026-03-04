import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { emailTemplates } from '@/lib/db/schema'
import { getOrCreateWorkspace } from '@/lib/db/queries/workspace'
import { eq, and } from 'drizzle-orm'
import { EmailBlock } from '@/types'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getOrCreateWorkspace(user.id, user.email ?? '')

  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(
      and(
        eq(emailTemplates.id, id),
        eq(emailTemplates.workspace_id, workspace.id),
      ),
    )
    .limit(1)

  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  return NextResponse.json({ template })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getOrCreateWorkspace(user.id, user.email ?? '')
  const body = (await request.json().catch(() => ({}))) as {
    name?: string
    subject?: string
    from_name?: string | null
    from_email?: string | null
    reply_to?: string | null
    blocks?: EmailBlock[]
  }

  const [updated] = await db
    .update(emailTemplates)
    .set({
      name: body.name?.trim() || 'Template sem nome',
      subject: body.subject?.trim() || 'Assunto',
      from_name: body.from_name?.trim() || null,
      from_email: body.from_email?.trim() || null,
      reply_to: body.reply_to?.trim() || null,
      blocks: Array.isArray(body.blocks) ? body.blocks : [],
      updated_at: new Date(),
    })
    .where(
      and(
        eq(emailTemplates.id, id),
        eq(emailTemplates.workspace_id, workspace.id),
      ),
    )
    .returning()

  if (!updated) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  return NextResponse.json({ template: updated })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getOrCreateWorkspace(user.id, user.email ?? '')

  await db.delete(emailTemplates).where(
    and(
      eq(emailTemplates.id, id),
      eq(emailTemplates.workspace_id, workspace.id),
    ),
  )

  return NextResponse.json({ ok: true })
}
