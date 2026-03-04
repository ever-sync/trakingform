import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { webhookDestinations } from '@/lib/db/schema'
import { getOrCreateWorkspace } from '@/lib/db/queries/workspace'
import { eq } from 'drizzle-orm'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getOrCreateWorkspace(user.id, user.email ?? '')
  const destinations = await db
    .select()
    .from(webhookDestinations)
    .where(eq(webhookDestinations.workspace_id, workspace.id))

  return NextResponse.json(destinations)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getOrCreateWorkspace(user.id, user.email ?? '')
  const body = await req.json() as {
    name: string
    url: string
    type?: string
    method?: string
    headers?: Record<string, string>
    payload_template?: unknown
  }

  if (!body.name || !body.url) {
    return NextResponse.json({ error: 'Name and URL required' }, { status: 400 })
  }

  const [created] = await db
    .insert(webhookDestinations)
    .values({
      workspace_id: workspace.id,
      name: body.name,
      url: body.url,
      type: (body.type as 'generic') ?? 'generic',
      method: body.method ?? 'POST',
      headers: body.headers ?? {},
      payload_template: body.payload_template ?? null,
    })
    .returning()

  return NextResponse.json(created)
}
