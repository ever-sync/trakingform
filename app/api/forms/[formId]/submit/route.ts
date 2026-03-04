import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { db } from '@/lib/db'
import { forms, leads, leadEvents } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { enrichLeadWithIP } from '@/lib/services/ip-enrichment'
import { detectDuplicate } from '@/lib/services/duplicate-detector'
import { dispatchWebhooksForLead } from '@/lib/services/webhook-dispatcher'
import { notifyWhatsApp } from '@/lib/services/whatsapp-notifier'
import { recordVariantSubmission } from '@/lib/services/ab-test'
import { calculateEnhancedLeadScore } from '@/lib/services/ai-lead-score'
import { validateFormSubmission } from '@/lib/services/form-validator'
import { FormField } from '@/types'

function getActiveFields(fields: unknown, settings: unknown): FormField[] {
  const draftFields = Array.isArray(fields) ? (fields as FormField[]) : []

  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return draftFields
  const builder = (settings as { builder?: unknown }).builder
  if (!builder || typeof builder !== 'object' || Array.isArray(builder)) return draftFields

  const publishedFields = (builder as { published_fields?: unknown }).published_fields
  if (Array.isArray(publishedFields)) return publishedFields as FormField[]

  return draftFields
}

let ratelimit: Ratelimit | null = null

function getRateLimit() {
  if (ratelimit) return ratelimit

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!redisUrl || !redisToken) return null

  ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, '1 m'),
  })

  return ratelimit
}

const INTERNAL_FIELDS = ['_hp', '_fp', '_start_time', '_utm_source', '_utm_medium', '_utm_campaign', '_utm_term', '_utm_content', '_referrer', '_variant_id', '_progressive']

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { formId } = await params
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'

  // Rate limit per form + IP
  const limiter = getRateLimit()
  if (limiter) {
    const { success } = await limiter.limit(`form:${formId}:${ip}`)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }
  }

  // Load form
  const form = await db.query.forms.findFirst({
    where: eq(forms.id, formId),
  })

  if (!form || !form.is_active) {
    return NextResponse.json({ error: 'Form not found' }, { status: 404 })
  }

  const body = (await req.json()) as Record<string, unknown>
  const email = typeof body.email === 'string' ? body.email : undefined
  const phone = typeof body.phone === 'string' ? body.phone : undefined

  // Honeypot check — silent reject bots
  if (body._hp) {
    return NextResponse.json({ success: true, message: form.submit_message })
  }

  // Validate required fields
  const fields = getActiveFields(form.fields, form.settings)
  const errors = validateFormSubmission(fields, body)

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 422 })
  }

  const userAgent = req.headers.get('user-agent') ?? ''
  const fingerprint = typeof body._fp === 'string' ? body._fp : null
  const startTime = body._start_time ? Date.now() - Number(body._start_time) : null

  // Extract UTM params
  const utmSource = typeof body._utm_source === 'string' ? body._utm_source : null
  const utmMedium = typeof body._utm_medium === 'string' ? body._utm_medium : null
  const utmCampaign = typeof body._utm_campaign === 'string' ? body._utm_campaign : null
  const utmTerm = typeof body._utm_term === 'string' ? body._utm_term : null
  const utmContent = typeof body._utm_content === 'string' ? body._utm_content : null
  const referrer = typeof body._referrer === 'string' ? body._referrer : null
  const variantId = typeof body._variant_id === 'string' ? body._variant_id : null

  // Detect duplicate
  const duplicateId = await detectDuplicate({
    workspaceId: form.workspace_id!,
    email,
    phone,
    fingerprint,
  })
  const duplicateOf = duplicateId ?? null
  const completionSeconds = startTime ? Math.round(startTime / 1000) : null

  // Strip internal fields from saved data
  const cleanData = Object.fromEntries(
    Object.entries(body).filter(([key]) => !INTERNAL_FIELDS.includes(key))
  )
  const trackedData = {
    ...cleanData,
    ...(utmSource ? { utm_source: utmSource } : {}),
    ...(utmMedium ? { utm_medium: utmMedium } : {}),
    ...(utmCampaign ? { utm_campaign: utmCampaign } : {}),
    ...(utmTerm ? { utm_term: utmTerm } : {}),
    ...(utmContent ? { utm_content: utmContent } : {}),
    ...(referrer ? { referrer } : {}),
  }

  // Calculate enhanced lead score
  const emailDomain = email ? email.split('@')[1] ?? '' : ''
  const filledFields = Object.entries(cleanData).filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
  const scoringResult = calculateEnhancedLeadScore({
    data: cleanData as Record<string, unknown>,
    emailDomain,
    phoneValid: !!phone && phone.length >= 8,
    timeToCompleteSeconds: startTime ? Math.round(startTime / 1000) : 0,
    deviceType: /mobile|android|iphone/i.test(userAgent) ? 'mobile' : 'desktop',
    isVPN: false,
    isProxy: false,
    allRequiredFieldsFilled: Object.keys(errors).length === 0,
    isDuplicate: !!duplicateId,
    hasUtmSource: !!utmSource,
    fieldsFilledCount: filledFields.length,
    totalFieldsCount: fields.length,
  })
  const leadScore = scoringResult.score

  // Progressive Profiling: check if lead already exists for this form (by email)
  const isProgressive = typeof body._progressive === 'string' && body._progressive === '1'
  let lead: typeof leads.$inferSelect

  if (isProgressive && email) {
    // Find existing lead with matching email in this form
    const existingLeads = await db
      .select()
      .from(leads)
      .where(and(eq(leads.form_id, formId)))
      .orderBy(desc(leads.created_at))
      .limit(50)

    const existingLead = existingLeads.find(l => {
      const data = l.data as Record<string, unknown> | null
      if (!data) return false
      const leadEmail = String(data.email || '').toLowerCase().trim()
      return leadEmail === email.toLowerCase().trim()
    })

    if (existingLead) {
      // Merge new data with existing data
      const existingData = (existingLead.data as Record<string, unknown>) ?? {}
      const mergedData = { ...existingData, ...trackedData }

      const [updated] = await db
        .update(leads)
        .set({
          data: mergedData,
          ip_address: ip,
          score: leadScore,
          is_duplicate: !!duplicateId && duplicateId !== existingLead.id,
          duplicate_of: duplicateId && duplicateId !== existingLead.id ? duplicateId : null,
          time_to_complete_seconds: completionSeconds,
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
          utm_term: utmTerm,
          utm_content: utmContent,
          referrer,
          variant_id: variantId,
          updated_at: new Date(),
        })
        .where(eq(leads.id, existingLead.id))
        .returning()

      lead = updated

      // Log update event
      await db.insert(leadEvents).values({
        lead_id: lead.id,
        type: 'profile_updated',
        description: `Lead atualizado via progressive profiling`,
        metadata: { new_fields: Object.keys(cleanData) },
      })
    } else {
      // No existing lead found, create new one
      const [newLead] = await db.insert(leads).values({
        workspace_id: form.workspace_id,
        form_id: formId,
        data: trackedData,
        ip_address: ip,
        fingerprint,
        score: leadScore,
        is_duplicate: !!duplicateId,
        duplicate_of: duplicateOf,
        time_to_complete_seconds: completionSeconds,
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        utm_term: utmTerm,
        utm_content: utmContent,
        referrer,
        variant_id: variantId,
      }).returning()
      lead = newLead

      await db.insert(leadEvents).values({
        lead_id: lead.id,
        type: 'created',
        description: `Lead capturado via formulário "${form.name}"`,
        metadata: utmSource ? { utm_source: utmSource, utm_medium: utmMedium, utm_campaign: utmCampaign } : undefined,
      })
    }
  } else {
    // Normal flow: always create new lead
    const [newLead] = await db.insert(leads).values({
      workspace_id: form.workspace_id,
      form_id: formId,
      data: trackedData,
      ip_address: ip,
      fingerprint,
      score: leadScore,
      is_duplicate: !!duplicateId,
      duplicate_of: duplicateOf,
      time_to_complete_seconds: completionSeconds,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_term: utmTerm,
      utm_content: utmContent,
      referrer,
      variant_id: variantId,
    }).returning()
    lead = newLead

    // Log creation event
    await db.insert(leadEvents).values({
      lead_id: lead.id,
      type: 'created',
      description: `Lead capturado via formulário "${form.name}"`,
      metadata: utmSource ? { utm_source: utmSource, utm_medium: utmMedium, utm_campaign: utmCampaign } : undefined,
    })
  }

  await db.insert(leadEvents).values({
    lead_id: lead.id,
    type: 'score_updated',
    description: `Score calculado: ${leadScore}`,
    metadata: {
      score: leadScore,
      factors: scoringResult.factors,
    },
  })

  // Update form submission count (fire and forget)
  db.update(forms)
    .set({ total_submissions: (form.total_submissions ?? 0) + 1 })
    .where(eq(forms.id, formId))
    .catch(console.error)

  // Async: enrich IP + dispatch webhooks + WhatsApp alert
  Promise.all([
    enrichLeadWithIP(lead.id, ip, userAgent),
    dispatchWebhooksForLead(lead.id, formId, {
      ...cleanData,
      _form_name: form.name,
      _lead_id: lead.id,
      _utm_source: utmSource,
      _utm_medium: utmMedium,
      _utm_campaign: utmCampaign,
      _variant_id: variantId,
      _score: leadScore,
    }),
    notifyWhatsApp({
      workspaceId: form.workspace_id!,
      leadData: cleanData as Record<string, unknown>,
      score: leadScore,
    }),
  ]).catch(console.error)

  // Track A/B variant submission
  if (variantId) {
    recordVariantSubmission(variantId).catch(console.error)
  }

  return NextResponse.json({
    success: true,
    message: form.submit_message,
    redirect_url: form.submit_redirect_url,
  })
}

// CORS preflight for embeds
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
