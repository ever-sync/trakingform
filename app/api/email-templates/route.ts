import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { emailTemplates } from '@/lib/db/schema'
import { getOrCreateWorkspace } from '@/lib/db/queries/workspace'
import { desc, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

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

  const body = (await request.json().catch(() => ({}))) as {
    name?: string
    subject?: string
    from_name?: string
    from_email?: string
    reply_to?: string
  }

  const name = body.name?.trim() ?? ''
  const subject = body.subject?.trim() ?? ''
  const fromEmail = body.from_email?.trim() ?? ''
  const replyTo = body.reply_to?.trim() ?? ''

  if (!name || !subject) {
    return NextResponse.json({ error: 'Nome e assunto sao obrigatorios' }, { status: 400 })
  }

  if (fromEmail && !isValidEmail(fromEmail)) {
    return NextResponse.json({ error: 'from_email invalido' }, { status: 400 })
  }

  if (replyTo && !isValidEmail(replyTo)) {
    return NextResponse.json({ error: 'reply_to invalido' }, { status: 400 })
  }

  const [template] = await db
    .insert(emailTemplates)
    .values({
      workspace_id: workspace.id,
      name,
      subject,
      from_name: body.from_name?.trim() || null,
      from_email: fromEmail || null,
      reply_to: replyTo || null,
      blocks: [],
    })
    .returning()

  return NextResponse.json({ template }, { status: 201 })
}
