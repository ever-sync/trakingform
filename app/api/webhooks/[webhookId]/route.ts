import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { webhookDestinations } from '@/lib/db/schema'
import { getOrCreateWorkspace } from '@/lib/db/queries/workspace'

const ALLOWED_WEBHOOK_TYPES = ['generic', 'n8n', 'evolution_api', 'google_sheets', 'pipedrive', 'hubspot'] as const
const ALLOWED_METHODS = ['POST', 'GET', 'PUT', 'PATCH'] as const

async function getWorkspace(userId: string, userEmail: string) {
  return getOrCreateWorkspace(userId, userEmail)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ webhookId: string }> }
) {
  const { webhookId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!webhookId) return NextResponse.json({ error: 'Webhook ID obrigatorio.' }, { status: 400 })

  const workspace = await getWorkspace(user.id, user.email ?? '')
  const body = (await req.json()) as {
    name?: string
    url?: string
    type?: string
    method?: string
    headers?: Record<string, string>
    payload_template?: unknown
    is_active?: boolean
  }

  const updateData: Partial<typeof webhookDestinations.$inferInsert> & { updated_at: Date } = {
    updated_at: new Date(),
  }

  if (body.name !== undefined) {
    const normalizedName = body.name.trim()
    if (!normalizedName) {
      return NextResponse.json({ error: 'Nome não pode ser vazio.' }, { status: 400 })
    }
    updateData.name = normalizedName
  }

  if (body.url !== undefined) {
    const normalizedUrl = body.url.trim()
    let parsedUrl: URL
    try {
      parsedUrl = new URL(normalizedUrl)
    } catch {
      return NextResponse.json({ error: 'URL inválida.' }, { status: 400 })
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: 'A URL deve iniciar com http:// ou https://.' }, { status: 400 })
    }

    updateData.url = parsedUrl.toString()
  }

  if (body.type !== undefined) {
    updateData.type = ALLOWED_WEBHOOK_TYPES.includes(body.type as (typeof ALLOWED_WEBHOOK_TYPES)[number])
      ? (body.type as (typeof ALLOWED_WEBHOOK_TYPES)[number])
      : 'generic'
  }

  if (body.method !== undefined) {
    const requestedMethod = body.method.trim().toUpperCase()
    updateData.method = ALLOWED_METHODS.includes(requestedMethod as (typeof ALLOWED_METHODS)[number])
      ? requestedMethod
      : 'POST'
  }

  if (body.headers !== undefined) updateData.headers = body.headers
  if (body.payload_template !== undefined) updateData.payload_template = body.payload_template
  if (body.is_active !== undefined) updateData.is_active = !!body.is_active

  if (Object.keys(updateData).length === 1) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar.' }, { status: 400 })
  }

  const [updated] = await db
    .update(webhookDestinations)
    .set(updateData)
    .where(and(eq(webhookDestinations.id, webhookId), eq(webhookDestinations.workspace_id, workspace.id)))
    .returning()

  if (!updated) return NextResponse.json({ error: 'Webhook não encontrado.' }, { status: 404 })

  revalidatePath('/webhooks')
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ webhookId: string }> }
) {
  const { webhookId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!webhookId) return NextResponse.json({ error: 'Webhook ID obrigatorio.' }, { status: 400 })

  const workspace = await getWorkspace(user.id, user.email ?? '')

  const deleted = await db
    .delete(webhookDestinations)
    .where(and(eq(webhookDestinations.id, webhookId), eq(webhookDestinations.workspace_id, workspace.id)))
    .returning({ id: webhookDestinations.id })

  if (deleted.length === 0) {
    return NextResponse.json({ error: 'Webhook não encontrado.' }, { status: 404 })
  }

  revalidatePath('/webhooks')
  return NextResponse.json({ success: true, id: deleted[0].id })
}
