import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { forms } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getOrCreateWorkspace } from '@/lib/db/queries/workspace'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getOrCreateWorkspace(user.id, user.email!)

  const formList = await db
    .select()
    .from(forms)
    .where(eq(forms.workspace_id, workspace.id))
    .orderBy(desc(forms.created_at))

  return NextResponse.json(formList)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json()) as {
    name?: string
    description?: string | null
    fields?: unknown
    settings?: unknown
    theme?: unknown
  }
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 422 })
  }

  const workspace = await getOrCreateWorkspace(user.id, user.email!)

  const [form] = await db
    .insert(forms)
    .values({
      workspace_id: workspace.id,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      fields: Array.isArray(body.fields) ? body.fields : undefined,
      settings: body.settings ?? undefined,
      theme: body.theme ?? undefined,
    })
    .returning()

  return NextResponse.json(form)
}
