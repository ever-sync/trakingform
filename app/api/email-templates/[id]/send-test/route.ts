import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { emailTemplates } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getOrCreateWorkspace } from '@/lib/db/queries/workspace'
import { emailProviderRegistry } from '@/lib/services/email/provider-registry'
import { renderEmailBlocks, renderBlocksAsText, replaceTemplateVariables } from '@/lib/services/email/render'
import { EmailBlock } from '@/types'

const DEFAULT_PREVIEW_VARS: Record<string, string> = {
  name: 'Maria',
  email: 'maria@empresa.com',
  form_name: 'Formulario de Leads',
  submit_message: 'Obrigado! Em breve entraremos em contato.',
  utm_source: 'google',
  created_at: new Date().toISOString(),
  unsubscribe_url: '#',
}

// Simple in-memory rate limit for test emails (5 per hour per workspace)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(workspaceId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(workspaceId)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(workspaceId, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return true
  }

  if (entry.count >= 5) return false
  entry.count++
  return true
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getOrCreateWorkspace(user.id, user.email ?? '')

  if (!checkRateLimit(workspace.id)) {
    return NextResponse.json({ error: 'Limite de 5 emails de teste por hora atingido.' }, { status: 429 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    recipientEmail?: string
    variables?: Record<string, string>
  }

  const recipientEmail = body.recipientEmail?.trim() || user.email
  if (!recipientEmail) return NextResponse.json({ error: 'Email do destinatario nao informado.' }, { status: 400 })

  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(and(eq(emailTemplates.id, id), eq(emailTemplates.workspace_id, workspace.id)))
    .limit(1)

  if (!template) return NextResponse.json({ error: 'Template nao encontrado.' }, { status: 404 })

  const blocks = Array.isArray(template.blocks) ? (template.blocks as EmailBlock[]) : []
  const vars = { ...DEFAULT_PREVIEW_VARS, ...(body.variables ?? {}) }

  try {
    const provider = emailProviderRegistry.getPrimary()
    const result = await provider.send({
      to: recipientEmail,
      fromName: template.from_name || 'LeadForm',
      fromEmail: template.from_email || 'noreply@leadform.app',
      replyTo: template.reply_to ?? undefined,
      subject: `[TESTE] ${replaceTemplateVariables(template.subject || 'Test', vars)}`,
      html: renderEmailBlocks(blocks, vars),
      text: renderBlocksAsText(blocks, vars),
    })

    return NextResponse.json({ ok: true, messageId: result.messageId })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao enviar email de teste.' },
      { status: 500 },
    )
  }
}
