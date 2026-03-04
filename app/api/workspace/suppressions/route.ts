import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { emailSuppressions } from '@/lib/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { getWorkspaceForUser } from '@/lib/db/queries/workspace'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getWorkspaceForUser(user.id)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const rows = await db
    .select()
    .from(emailSuppressions)
    .where(and(eq(emailSuppressions.workspace_id, workspace.id), eq(emailSuppressions.is_active, true)))
    .orderBy(desc(emailSuppressions.created_at))
    .limit(200)

  return NextResponse.json({ items: rows })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getWorkspaceForUser(user.id)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const body = (await req.json()) as { email?: unknown; reason?: unknown }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'E-mail inválido' }, { status: 400 })
  }

  const reason = typeof body.reason === 'string' ? body.reason : 'manual'

  const [row] = await db
    .insert(emailSuppressions)
    .values({ workspace_id: workspace.id, email, reason, source: 'user', is_active: true })
    .onConflictDoNothing()
    .returning()

  return NextResponse.json({ item: row ?? null })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getWorkspaceForUser(user.id)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

  await db
    .update(emailSuppressions)
    .set({ is_active: false, updated_at: new Date() })
    .where(and(eq(emailSuppressions.id, id), eq(emailSuppressions.workspace_id, workspace.id)))

  return NextResponse.json({ success: true })
}
