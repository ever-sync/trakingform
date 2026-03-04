import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { emailTemplates } from '@/lib/db/schema'
import { getOrCreateWorkspace } from '@/lib/db/queries/workspace'
import { eq, desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getOrCreateWorkspace(user.id, user.email ?? '')

  const templates = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.workspace_id, workspace.id))
    .orderBy(desc(emailTemplates.created_at))

  return NextResponse.json({ templates })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getOrCreateWorkspace(user.id, user.email ?? '')

  const body = await request.json() as {
    name: string
    subject: string
    from_name?: string
    from_email?: string
    reply_to?: string
  }

  const { name, subject, from_name, from_email, reply_to } = body

  if (!name?.trim() || !subject?.trim()) {
    return NextResponse.json({ error: 'Nome e assunto são obrigatórios' }, { status: 400 })
  }

  const [template] = await db.insert(emailTemplates).values({
    workspace_id: workspace.id,
    name: name.trim(),
    subject: subject.trim(),
    from_name: from_name?.trim() || null,
    from_email: from_email?.trim() || null,
    reply_to: reply_to?.trim() || null,
    blocks: [],
  }).returning()

  return NextResponse.json({ template }, { status: 201 })
}
