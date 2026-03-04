import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { webhookDestinations } from '@/lib/db/schema'
import { getOrCreateWorkspace } from '@/lib/db/queries/workspace'
import { eq, desc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

const ALLOWED_WEBHOOK_TYPES = ['generic', 'n8n', 'evolution_api', 'google_sheets', 'pipedrive', 'hubspot'] as const
const ALLOWED_METHODS = ['POST', 'GET', 'PUT', 'PATCH'] as const

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getOrCreateWorkspace(user.id, user.email ?? '')
  const destinations = await db
    .select()
    .from(webhookDestinations)
    .where(eq(webhookDestinations.workspace_id, workspace.id))
    .orderBy(desc(webhookDestinations.created_at))

  return NextResponse.json(destinations)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const workspace = await getOrCreateWorkspace(user.id, user.email ?? '')
    const body = (await req.json()) as {
      name: string
      url: string
      type?: string
      method?: string
      headers?: Record<string, string>
      payload_template?: unknown
    }

    if (!body || !body.name?.trim() || !body.url?.trim()) {
      return NextResponse.json({ error: 'Nome e URL são obrigatórios.' }, { status: 400 })
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(body.url.trim())
    } catch {
      return NextResponse.json({ error: 'URL inválida.' }, { status: 400 })
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: 'A URL deve iniciar com http:// ou https://.' }, { status: 400 })
    }

    const type = ALLOWED_WEBHOOK_TYPES.includes((body.type ?? 'generic') as (typeof ALLOWED_WEBHOOK_TYPES)[number])
      ? (body.type as (typeof ALLOWED_WEBHOOK_TYPES)[number])
      : 'generic'

    const requestedMethod =
      typeof body.method === 'string' && body.method.trim().length > 0
        ? body.method.toUpperCase()
        : 'POST'
    const method = ALLOWED_METHODS.includes(requestedMethod as (typeof ALLOWED_METHODS)[number])
      ? requestedMethod
      : 'POST'

    const [created] = await db
      .insert(webhookDestinations)
      .values({
        workspace_id: workspace.id,
        name: body.name.trim(),
        url: parsedUrl.toString(),
        type,
        method,
        headers: body.headers ?? {},
        payload_template: body.payload_template ?? null,
      })
      .returning()

    revalidatePath('/webhooks')
    return NextResponse.json(created)
  } catch (error) {
    console.error('Failed to create webhook destination:', error)
    return NextResponse.json({ error: 'Erro ao salvar webhook.' }, { status: 500 })
  }
}
