import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { whatsappConfigs } from '@/lib/db/schema'
import { getOrCreateWorkspace } from '@/lib/db/queries/workspace'
import { eq } from 'drizzle-orm'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getOrCreateWorkspace(user.id, user.email ?? '')
  const configs = await db
    .select()
    .from(whatsappConfigs)
    .where(eq(whatsappConfigs.workspace_id, workspace.id))
    .limit(1)

  return NextResponse.json(configs[0] ?? null)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getOrCreateWorkspace(user.id, user.email ?? '')
  const body = await req.json() as {
    instance_name: string
    api_url: string
    api_key: string
    notify_number: string
    min_score?: number
    is_active?: boolean
    message_template?: string
  }

  if (!body.instance_name || !body.api_url || !body.api_key || !body.notify_number) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Upsert: check if config exists
  const existing = await db
    .select({ id: whatsappConfigs.id })
    .from(whatsappConfigs)
    .where(eq(whatsappConfigs.workspace_id, workspace.id))
    .limit(1)

  if (existing.length > 0) {
    const [updated] = await db
      .update(whatsappConfigs)
      .set({
        instance_name: body.instance_name,
        api_url: body.api_url.replace(/\/$/, ''),
        api_key: body.api_key,
        notify_number: body.notify_number,
        min_score: body.min_score ?? 70,
        is_active: body.is_active !== false,
        message_template: body.message_template,
        updated_at: new Date(),
      })
      .where(eq(whatsappConfigs.id, existing[0].id))
      .returning()

    return NextResponse.json(updated)
  }

  const [created] = await db
    .insert(whatsappConfigs)
    .values({
      workspace_id: workspace.id,
      instance_name: body.instance_name,
      api_url: body.api_url.replace(/\/$/, ''),
      api_key: body.api_key,
      notify_number: body.notify_number,
      min_score: body.min_score ?? 70,
      is_active: body.is_active !== false,
      message_template: body.message_template,
    })
    .returning()

  return NextResponse.json(created)
}
