import { db } from '@/lib/db'
import { formVariants, forms, leads, leadEvents } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { FormField, FormTheme } from '@/types'

interface SelectedVariant {
  variantId: string
  fields: FormField[]
  theme: unknown
  name: string
}

export interface AutoWinnerConfig {
  enabled: boolean
  minDays: number
  minViews: number
  appliedAt: string | null
  winnerVariantId: string | null
  lastEvaluatedAt: string | null
}

interface ApplyWinnerParams {
  formId: string
  winnerVariantId: string
  source: 'manual' | 'auto'
  minDays?: number
  minViews?: number
  actorUserId?: string | null
  actorEmail?: string | null
}

interface ApplyWinnerResult {
  applied: boolean
  winnerVariantId: string | null
  winnerName: string | null
  timelineEventsInserted: number
}

const DEFAULT_AUTO_WINNER_CONFIG: AutoWinnerConfig = {
  enabled: false,
  minDays: 7,
  minViews: 100,
  appliedAt: null,
  winnerVariantId: null,
  lastEvaluatedAt: null,
}

function parseSettingsObject(settings: unknown): Record<string, unknown> {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return {}
  return settings as Record<string, unknown>
}

function parsePositiveNumber(value: unknown, fallback: number, min = 1, max = 3650): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

export function parseAutoWinnerConfig(settings: unknown): AutoWinnerConfig {
  const settingsObj = parseSettingsObject(settings)
  const raw = settingsObj.abAutoWinner
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return DEFAULT_AUTO_WINNER_CONFIG
  }

  const cfg = raw as Record<string, unknown>
  return {
    enabled: !!cfg.enabled,
    minDays: parsePositiveNumber(cfg.minDays, DEFAULT_AUTO_WINNER_CONFIG.minDays, 1, 365),
    minViews: parsePositiveNumber(cfg.minViews, DEFAULT_AUTO_WINNER_CONFIG.minViews, 1, 1_000_000),
    appliedAt: typeof cfg.appliedAt === 'string' ? cfg.appliedAt : null,
    winnerVariantId: typeof cfg.winnerVariantId === 'string' ? cfg.winnerVariantId : null,
    lastEvaluatedAt: typeof cfg.lastEvaluatedAt === 'string' ? cfg.lastEvaluatedAt : null,
  }
}

function getVariantConversion(views: number | null, submissions: number | null): number {
  const safeViews = views ?? 0
  const safeSubmissions = submissions ?? 0
  if (safeViews <= 0) return 0
  return safeSubmissions / safeViews
}

function chooseWinnerVariant(
  variants: Array<typeof formVariants.$inferSelect>,
  minViews: number
): (typeof formVariants.$inferSelect) | null {
  const eligible = variants.filter((variant) => (variant.total_views ?? 0) >= minViews)
  if (eligible.length === 0) return null

  return eligible.sort((a, b) => {
    const aConversion = getVariantConversion(a.total_views, a.total_submissions)
    const bConversion = getVariantConversion(b.total_views, b.total_submissions)
    if (bConversion !== aConversion) return bConversion - aConversion
    return (b.total_views ?? 0) - (a.total_views ?? 0)
  })[0] ?? null
}

async function insertWinnerTimelineEvents({
  formId,
  description,
  metadata,
}: {
  formId: string
  description: string
  metadata: Record<string, unknown>
}): Promise<number> {
  const leadRows = await db
    .select({ id: leads.id })
    .from(leads)
    .where(eq(leads.form_id, formId))

  if (leadRows.length === 0) return 0

  const chunkSize = 250
  for (let i = 0; i < leadRows.length; i += chunkSize) {
    const batch = leadRows.slice(i, i + chunkSize)
    await db.insert(leadEvents).values(
      batch.map((lead) => ({
        lead_id: lead.id,
        type: 'ab_winner_applied',
        description,
        metadata,
      }))
    )
  }

  return leadRows.length
}

export async function selectVariant(formId: string): Promise<SelectedVariant | null> {
  evaluateAndApplyAutoWinner(formId).catch(console.error)

  const variants = await db
    .select()
    .from(formVariants)
    .where(and(eq(formVariants.form_id, formId), eq(formVariants.is_active, true)))

  if (variants.length === 0) return null

  // Weighted random selection
  const totalWeight = variants.reduce((sum, v) => sum + (v.weight ?? 50), 0)
  let random = Math.random() * totalWeight

  for (const variant of variants) {
    random -= (variant.weight ?? 50)
    if (random <= 0) {
      return {
        variantId: variant.id,
        fields: Array.isArray(variant.fields) ? variant.fields as FormField[] : [],
        theme: variant.theme,
        name: variant.name,
      }
    }
  }

  // Fallback to first variant
  const first = variants[0]
  return {
    variantId: first.id,
    fields: Array.isArray(first.fields) ? first.fields as FormField[] : [],
    theme: first.theme,
    name: first.name,
  }
}

export async function recordVariantView(variantId: string): Promise<void> {
  const variant = await db
    .select({ total_views: formVariants.total_views, form_id: formVariants.form_id })
    .from(formVariants)
    .where(eq(formVariants.id, variantId))
    .limit(1)

  if (variant[0]) {
    const nextViews = (variant[0].total_views ?? 0) + 1
    await db
      .update(formVariants)
      .set({ total_views: nextViews })
      .where(eq(formVariants.id, variantId))

    if (variant[0].form_id && nextViews % 10 === 0) {
      evaluateAndApplyAutoWinner(variant[0].form_id).catch(console.error)
    }
  }
}

export async function recordVariantSubmission(variantId: string): Promise<void> {
  const variant = await db
    .select({ total_submissions: formVariants.total_submissions, form_id: formVariants.form_id })
    .from(formVariants)
    .where(eq(formVariants.id, variantId))
    .limit(1)

  if (variant[0]) {
    await db
      .update(formVariants)
      .set({ total_submissions: (variant[0].total_submissions ?? 0) + 1 })
      .where(eq(formVariants.id, variantId))

    if (variant[0].form_id) {
      evaluateAndApplyAutoWinner(variant[0].form_id).catch(console.error)
    }
  }
}

export async function applyWinnerVariant({
  formId,
  winnerVariantId,
  source,
  minDays,
  minViews,
  actorUserId,
  actorEmail,
}: ApplyWinnerParams): Promise<ApplyWinnerResult> {
  const variants = await db
    .select()
    .from(formVariants)
    .where(eq(formVariants.form_id, formId))

  const winner = variants.find((variant) => variant.id === winnerVariantId)
  if (!winner) {
    return {
      applied: false,
      winnerVariantId: null,
      winnerName: null,
      timelineEventsInserted: 0,
    }
  }

  const otherVariantIds = variants.filter((variant) => variant.id !== winnerVariantId).map((variant) => variant.id)

  if (otherVariantIds.length > 0) {
    await db
      .update(formVariants)
      .set({ is_active: false, weight: 0 })
      .where(inArray(formVariants.id, otherVariantIds))
  }

  await db
    .update(formVariants)
    .set({ is_active: true, weight: 100 })
    .where(eq(formVariants.id, winnerVariantId))

  const insertedCount = await insertWinnerTimelineEvents({
    formId,
    description:
      source === 'auto'
        ? `Vencedora A/B aplicada automaticamente: ${winner.name}`
        : `Vencedora A/B aplicada manualmente: ${winner.name}`,
    metadata: {
      winner_variant_id: winnerVariantId,
      winner_variant_name: winner.name,
      source,
      min_days: minDays ?? null,
      min_views: minViews ?? null,
      actor_user_id: actorUserId ?? null,
      actor_email: actorEmail ?? null,
      applied_at: new Date().toISOString(),
    },
  })

  return {
    applied: true,
    winnerVariantId,
    winnerName: winner.name,
    timelineEventsInserted: insertedCount,
  }
}

export async function evaluateAndApplyAutoWinner(formId: string): Promise<ApplyWinnerResult | null> {
  const [form] = await db
    .select({
      id: forms.id,
      settings: forms.settings,
      created_at: forms.created_at,
    })
    .from(forms)
    .where(eq(forms.id, formId))
    .limit(1)

  if (!form) return null

  const config = parseAutoWinnerConfig(form.settings)
  if (!config.enabled || config.appliedAt) return null

  const activeVariants = await db
    .select()
    .from(formVariants)
    .where(and(eq(formVariants.form_id, formId), eq(formVariants.is_active, true)))

  if (activeVariants.length < 2) return null

  const testStartMs = activeVariants.reduce((minMs, variant) => {
    const createdAtMs = variant.created_at ? new Date(variant.created_at).getTime() : Number.POSITIVE_INFINITY
    return Math.min(minMs, createdAtMs)
  }, form.created_at ? new Date(form.created_at).getTime() : Date.now())

  const minStartDateMs = Date.now() - config.minDays * 24 * 60 * 60 * 1000
  if (testStartMs > minStartDateMs) return null

  const winner = chooseWinnerVariant(activeVariants, config.minViews)
  if (!winner) return null

  const appliedResult = await applyWinnerVariant({
    formId,
    winnerVariantId: winner.id,
    source: 'auto',
    minDays: config.minDays,
    minViews: config.minViews,
  })

  if (!appliedResult.applied) return appliedResult

  const settingsObj = parseSettingsObject(form.settings)
  const nowIso = new Date().toISOString()
  const nextConfig: AutoWinnerConfig = {
    ...config,
    appliedAt: nowIso,
    winnerVariantId: winner.id,
    lastEvaluatedAt: nowIso,
  }

  await db
    .update(forms)
    .set({
      settings: {
        ...settingsObj,
        abAutoWinner: nextConfig,
      },
      updated_at: new Date(),
    })
    .where(eq(forms.id, formId))

  return appliedResult
}
