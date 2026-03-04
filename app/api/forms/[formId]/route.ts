import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { forms } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getWorkspaceForUser } from '@/lib/db/queries/workspace'
import { FormField } from '@/types'

type BuilderSettings = {
  draft_version?: number
  published_version?: number
  published_at?: string | null
  published_fields?: FormField[]
}

function getBuilderSettings(settings: unknown): BuilderSettings {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return {}
  const builder = (settings as { builder?: unknown }).builder
  if (!builder || typeof builder !== 'object' || Array.isArray(builder)) return {}
  return builder as BuilderSettings
}

async function getFormWithAuth(formId: string, userId: string) {
  const workspace = await getWorkspaceForUser(userId)
  if (!workspace) return null

  const result = await db
    .select()
    .from(forms)
    .where(and(eq(forms.id, formId), eq(forms.workspace_id, workspace.id)))
    .limit(1)

  return result[0] ?? null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { formId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await getFormWithAuth(formId, user.id)
  if (!form) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(form)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { formId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await getFormWithAuth(formId, user.id)
  if (!form) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  type FormUpdatePayload = Partial<Pick<typeof forms.$inferInsert,
    | 'name'
    | 'description'
    | 'fields'
    | 'settings'
    | 'is_active'
    | 'submit_message'
    | 'submit_redirect_url'
    | 'theme'
    | 'allowed_domains'
    | 'email_template_id'
  >> & { publish?: boolean }

  const body = (await req.json()) as FormUpdatePayload & {
    multiStepConfig?: { multiStep: boolean; showProgressBar?: boolean; stepConfig?: unknown[] }
    progressiveProfiling?: boolean
    conversational?: boolean
    autoWinnerConfig?: {
      enabled?: boolean
      minDays?: number
      minViews?: number
      appliedAt?: string | null
      winnerVariantId?: string | null
      lastEvaluatedAt?: string | null
    }
  }

  const updateData: FormUpdatePayload & { updated_at: Date } = { updated_at: new Date() }
  if (body.name !== undefined) updateData.name = body.name
  if (body.description !== undefined) updateData.description = body.description
  if (body.fields !== undefined) updateData.fields = body.fields
  if (body.settings !== undefined) updateData.settings = body.settings
  if (body.is_active !== undefined) updateData.is_active = body.is_active
  if (body.submit_message !== undefined) updateData.submit_message = body.submit_message
  if (body.submit_redirect_url !== undefined) updateData.submit_redirect_url = body.submit_redirect_url
  if (body.theme !== undefined) updateData.theme = body.theme
  if (body.allowed_domains !== undefined) updateData.allowed_domains = body.allowed_domains
  if (body.email_template_id !== undefined) updateData.email_template_id = body.email_template_id

  if (body.fields !== undefined || body.publish) {
    const nextFields = (body.fields ?? form.fields) as FormField[]
    const existingSettings =
      form.settings && typeof form.settings === 'object' && !Array.isArray(form.settings)
        ? (form.settings as Record<string, unknown>)
        : {}

    const currentBuilder = getBuilderSettings(form.settings)
    const draftVersion = Math.max(1, (currentBuilder.draft_version ?? 1) + (body.fields !== undefined ? 1 : 0))
    const publishIncrement = body.publish ? 1 : 0
    const publishedVersion = Math.max(0, (currentBuilder.published_version ?? 0) + publishIncrement)

    const builderSettings: BuilderSettings = {
      ...currentBuilder,
      draft_version: draftVersion,
      published_version: publishedVersion,
    }

    if (body.publish) {
      builderSettings.published_at = new Date().toISOString()
      builderSettings.published_fields = nextFields
    }

    updateData.settings = {
      ...existingSettings,
      builder: builderSettings,
    }
  }

  if (body.multiStepConfig) {
    const existingSettings =
      form.settings && typeof form.settings === 'object' && !Array.isArray(form.settings)
        ? (form.settings as Record<string, unknown>)
        : {}

    const merged = updateData.settings && typeof updateData.settings === 'object' && !Array.isArray(updateData.settings)
      ? (updateData.settings as Record<string, unknown>)
      : existingSettings

    updateData.settings = {
      ...merged,
      multiStep: !!body.multiStepConfig.multiStep,
      showProgressBar: body.multiStepConfig.showProgressBar !== false,
      stepConfig: body.multiStepConfig.stepConfig ?? [],
    }
  }

  if (body.progressiveProfiling !== undefined) {
    const existing = updateData.settings && typeof updateData.settings === 'object' && !Array.isArray(updateData.settings)
      ? (updateData.settings as Record<string, unknown>)
      : (form.settings && typeof form.settings === 'object' && !Array.isArray(form.settings)
        ? (form.settings as Record<string, unknown>)
        : {})

    updateData.settings = { ...existing, progressiveProfiling: !!body.progressiveProfiling }
  }

  if (body.conversational !== undefined) {
    const existing = updateData.settings && typeof updateData.settings === 'object' && !Array.isArray(updateData.settings)
      ? (updateData.settings as Record<string, unknown>)
      : (form.settings && typeof form.settings === 'object' && !Array.isArray(form.settings)
        ? (form.settings as Record<string, unknown>)
        : {})

    updateData.settings = { ...existing, conversational: !!body.conversational }
  }

  if (body.autoWinnerConfig) {
    const existing = updateData.settings && typeof updateData.settings === 'object' && !Array.isArray(updateData.settings)
      ? (updateData.settings as Record<string, unknown>)
      : (form.settings && typeof form.settings === 'object' && !Array.isArray(form.settings)
        ? (form.settings as Record<string, unknown>)
        : {})

    const cfg = body.autoWinnerConfig
    const minDays = Number(cfg.minDays)
    const minViews = Number(cfg.minViews)

    updateData.settings = {
      ...existing,
      abAutoWinner: {
        enabled: !!cfg.enabled,
        minDays: Number.isFinite(minDays) ? Math.max(1, Math.min(365, Math.round(minDays))) : 7,
        minViews: Number.isFinite(minViews) ? Math.max(1, Math.min(1_000_000, Math.round(minViews))) : 100,
        appliedAt: typeof cfg.appliedAt === 'string' ? cfg.appliedAt : null,
        winnerVariantId: typeof cfg.winnerVariantId === 'string' ? cfg.winnerVariantId : null,
        lastEvaluatedAt: typeof cfg.lastEvaluatedAt === 'string' ? cfg.lastEvaluatedAt : null,
      },
    }
  }

  const [updated] = await db
    .update(forms)
    .set(updateData)
    .where(eq(forms.id, formId))
    .returning()

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { formId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await getFormWithAuth(formId, user.id)
  if (!form) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.delete(forms).where(eq(forms.id, formId))
  return NextResponse.json({ success: true })
}
