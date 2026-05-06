import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { buildUnsubscribeUrl } from '@/lib/email/unsubscribe-url'
import { isFormOriginAllowed } from '@/lib/security/form-origin'
import { getFormPublicRatelimit } from '@/lib/services/form-public-ratelimit'
import {
  emailTemplates,
  formSessionDrafts,
  forms,
  leadConsents,
  leadEvents,
  leads,
  opsAlerts,
  workspaces,
} from '@/lib/db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { enrichLeadWithIP } from '@/lib/services/ip-enrichment'
import { detectDuplicate } from '@/lib/services/duplicate-detector'
import { dispatchWebhooksForLead } from '@/lib/services/webhook-dispatcher'
import { notifyWhatsApp } from '@/lib/services/whatsapp-notifier'
import { recordVariantSubmission } from '@/lib/services/ab-test'
import { calculateEnhancedLeadScore } from '@/lib/services/ai-lead-score'
import { validateFormSubmission } from '@/lib/services/form-validator'
import { assignLeadByRoutingRules } from '@/lib/services/routing/engine'
import { buildAttributionSnapshot, recordLeadEvent } from '@/lib/services/lead-events'
import { enqueueEmailDispatch, processPendingEmailDispatches } from '@/lib/services/email/dispatcher'
import { PLANS } from '@/lib/stripe/plans'
import { FormField, Plan } from '@/types'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function jsonWithCors(data: unknown, init?: { status?: number }) {
  const res = NextResponse.json(data, init)
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    res.headers.set(key, value)
  })
  return res
}

function getActiveFields(fields: unknown, settings: unknown): FormField[] {
  const draftFields = Array.isArray(fields) ? (fields as FormField[]) : []

  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return draftFields
  const builder = (settings as { builder?: unknown }).builder
  if (!builder || typeof builder !== 'object' || Array.isArray(builder)) return draftFields

  const publishedFields = (builder as { published_fields?: unknown }).published_fields
  if (Array.isArray(publishedFields)) return publishedFields as FormField[]

  return draftFields
}

function pickValueFromBody(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function extractFieldValueByType(
  fields: FormField[],
  body: Record<string, unknown>,
  type: FormField['type'],
  fallbackNames: string[] = []
): string | undefined {
  for (const fallbackName of fallbackNames) {
    const fallbackValue = pickValueFromBody(body[fallbackName])
    if (fallbackValue) return fallbackValue
  }

  for (const field of fields) {
    if (field.type !== type) continue
    const candidate = pickValueFromBody(body[field.name])
    if (candidate) return candidate
  }

  return undefined
}

function extractLeadDataEmail(
  fields: FormField[],
  data: Record<string, unknown> | null | undefined
): string | undefined {
  if (!data) return undefined

  const directEmail = pickValueFromBody(data.email)
  if (directEmail) return directEmail.toLowerCase()

  for (const field of fields) {
    if (field.type !== 'email') continue
    const candidate = pickValueFromBody(data[field.name])
    if (candidate) return candidate.toLowerCase()
  }

  return undefined
}

const INTERNAL_FIELDS = ['_hp', '_fp', '_start_time', '_utm_source', '_utm_medium', '_utm_campaign', '_utm_term', '_utm_content', '_referrer', '_variant_id', '_progressive', '_draft_id']

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
 try {
  const { formId } = await params
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'

  // Rate limit per form + IP
  const limiter = getFormPublicRatelimit()
  if (limiter) {
    const { success } = await limiter.limit(`form:${formId}:${ip}`)
    if (!success) {
      return jsonWithCors(
        { error: 'Muitas tentativas. Aguarde um minuto e tente novamente.' },
        { status: 429 },
      )
    }
  }

  // Load form
  const form = await db.query.forms.findFirst({
    where: eq(forms.id, formId),
  })

  if (!form || !form.is_active) {
    return jsonWithCors({ error: 'Formulário não encontrado ou indisponível.' }, { status: 404 })
  }

  const allowed = form.allowed_domains as string[] | null | undefined
  if (!isFormOriginAllowed(req, allowed)) {
    return jsonWithCors({ error: 'Este site não está autorizado a enviar este formulário.' }, { status: 403 })
  }

  const body = (await req.json()) as Record<string, unknown>

  // Honeypot — rejeição silenciosa de bots
  if (body._hp) {
    return jsonWithCors({ success: true, message: form.submit_message })
  }

  const fields = getActiveFields(form.fields, form.settings)
  const email = extractFieldValueByType(fields, body, 'email', ['email'])
  const phone = extractFieldValueByType(fields, body, 'phone', ['phone', 'telefone', 'celular'])

  // Validate required fields
  const errors = validateFormSubmission(fields, body)

  if (Object.keys(errors).length > 0) {
    return jsonWithCors({ errors }, { status: 422 })
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
  const draftId = typeof body._draft_id === 'string' ? body._draft_id : null

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
  const attributionSnapshot = buildAttributionSnapshot({
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: utmCampaign,
    utm_term: utmTerm,
    utm_content: utmContent,
    referrer,
    form_id: formId,
    variant_id: variantId,
  })

  // Calculate enhanced lead score
  const emailDomain = email ? email.split('@')[1] ?? '' : ''
  const phoneDigitsCount = phone ? phone.replace(/\D/g, '').length : 0
  const filledFields = Object.entries(cleanData).filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
  const scoringResult = calculateEnhancedLeadScore({
    data: cleanData as Record<string, unknown>,
    emailDomain,
    phoneValid: phoneDigitsCount >= 10,
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

  const isProgressive = typeof body._progressive === 'string' && body._progressive === '1'
  let existingProgressiveLead: typeof leads.$inferSelect | null = null

  if (isProgressive && email) {
    const existingLeadRows = await db
      .select()
      .from(leads)
      .where(eq(leads.form_id, formId))
      .orderBy(desc(leads.created_at))
      .limit(50)

    const currentEmail = email.toLowerCase().trim()
    existingProgressiveLead =
      existingLeadRows.find((leadRow) => {
        const data = leadRow.data as Record<string, unknown> | null
        const leadEmail = extractLeadDataEmail(fields, data)
        return !!leadEmail && leadEmail === currentEmail
      }) ?? null
  }

  const consumesLeadQuota = !(isProgressive && email && existingProgressiveLead)

  if (consumesLeadQuota && form.workspace_id) {
    const [wsQuota] = await db
      .select({
        plan: workspaces.plan,
        leads_used_this_month: workspaces.leads_used_this_month,
      })
      .from(workspaces)
      .where(eq(workspaces.id, form.workspace_id))
      .limit(1)

    const planKey = (wsQuota?.plan ?? 'starter') as Plan
    const cap = PLANS[planKey].maxLeadsPerMonth
    if (Number.isFinite(cap)) {
      const used = wsQuota?.leads_used_this_month ?? 0
      if (used >= cap) {
        return jsonWithCors(
          {
            error:
              'Limite mensal de leads do seu plano foi atingido. Faça upgrade em Configurações → Cobrança.',
          },
          { status: 402 },
        )
      }
    }
  }

  let lead: typeof leads.$inferSelect
  let createdNewLead = false

  if (isProgressive && email) {
    if (existingProgressiveLead) {
      const existingLead = existingProgressiveLead
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
          attribution_snapshot: attributionSnapshot,
          stage_changed_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(leads.id, existingLead.id))
        .returning()

      lead = updated

      // Log update event
      await db.insert(leadEvents).values({
        lead_id: lead.id,
        type: 'profile_updated',
        description: 'Lead atualizado via progressive profiling',
        metadata: { new_fields: Object.keys(cleanData) },
      })
    } else {
      // No existing lead found, create new one
      createdNewLead = true
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
        attribution_snapshot: attributionSnapshot,
        stage_changed_at: new Date(),
      }).returning()
      lead = newLead

      await db.insert(leadEvents).values({
        lead_id: lead.id,
        type: 'created',
        description: `Lead capturado via formulário "${form.name}"`,
        metadata: utmSource ? { utm_source: utmSource, utm_medium: utmMedium, utm_campaign: utmCampaign } : undefined,
      })
      await recordLeadEvent({
        leadId: lead.id,
        type: 'lead_created',
        description: `Lead capturado via formulário "${form.name}"`,
        metadata: attributionSnapshot,
      })
    }
  } else {
    // Fluxo normal (ou progressive sem e-mail identificável): sempre novo lead
    createdNewLead = true
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
      attribution_snapshot: attributionSnapshot,
      stage_changed_at: new Date(),
    }).returning()
    lead = newLead

    // Log creation event
    await db.insert(leadEvents).values({
      lead_id: lead.id,
      type: 'created',
      description: `Lead capturado via formulário "${form.name}"`,
      metadata: utmSource ? { utm_source: utmSource, utm_medium: utmMedium, utm_campaign: utmCampaign } : undefined,
    })
    await recordLeadEvent({
      leadId: lead.id,
      type: 'lead_created',
      description: `Lead capturado via formulário "${form.name}"`,
      metadata: attributionSnapshot,
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

  if (createdNewLead && form.workspace_id) {
    db.update(workspaces)
      .set({
        leads_used_this_month: sql`COALESCE(${workspaces.leads_used_this_month}, 0) + 1`,
        updated_at: new Date(),
      })
      .where(eq(workspaces.id, form.workspace_id))
      .catch(console.error)
  }

  const webhookPayload: Record<string, unknown> = {
    ...cleanData,
    _form_id: formId,
    _form_name: form.name,
    _workspace_id: form.workspace_id,
    _lead_id: lead.id,
    _lead_status: lead.status ?? 'new',
    _score: leadScore,
    _variant_id: variantId,
    _is_duplicate: !!lead.is_duplicate,
    _duplicate_of: lead.duplicate_of ?? null,
    _ip_address: ip,
    _fingerprint: fingerprint,
    _user_agent: userAgent,
    _time_to_complete_seconds: completionSeconds,
    _submitted_at: new Date().toISOString(),
    _utm_source: utmSource,
    _utm_medium: utmMedium,
    _utm_campaign: utmCampaign,
    _utm_term: utmTerm,
    _utm_content: utmContent,
    _referrer: referrer,
    form: {
      id: formId,
      name: form.name,
      workspace_id: form.workspace_id,
    },
    lead: {
      id: lead.id,
      status: lead.status ?? 'new',
      score: leadScore,
      is_duplicate: !!lead.is_duplicate,
      duplicate_of: lead.duplicate_of ?? null,
      created_at: lead.created_at ? new Date(lead.created_at).toISOString() : null,
      updated_at: lead.updated_at ? new Date(lead.updated_at).toISOString() : null,
    },
    tracking: {
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_term: utmTerm,
      utm_content: utmContent,
      referrer,
      variant_id: variantId,
      ip_address: ip,
      user_agent: userAgent,
      fingerprint,
      time_to_complete_seconds: completionSeconds,
    },
    answers: cleanData,
  }

  // Contagem atômica (evita race em concorrência)
  db.update(forms)
    .set({ total_submissions: sql`COALESCE(${forms.total_submissions}, 0) + 1` })
    .where(eq(forms.id, formId))
    .catch(console.error)

  if (draftId) {
    db
      .update(formSessionDrafts)
      .set({
        status: 'converted',
        converted_lead_id: lead.id,
        updated_at: new Date(),
      })
      .where(eq(formSessionDrafts.id, draftId))
      .catch(console.error)
  }

  const consentFields = fields.filter((field) => {
    if (!['checkbox', 'radio'].includes(field.type)) return false
    const combined = `${field.name} ${field.label}`.toLowerCase()
    return combined.includes('consent') || combined.includes('termo') || combined.includes('lgpd') || combined.includes('autoriz')
  })

  if (consentFields.length > 0) {
    const consentRows = consentFields
      .map((field) => {
        const value = body[field.name]
        const granted = Array.isArray(value)
          ? value.length > 0
          : value !== undefined && String(value).trim().length > 0
        return {
          workspace_id: form.workspace_id!,
          lead_id: lead.id,
          form_id: formId,
          consent_key: field.name,
          consent_text: field.label ?? null,
          consent_version: 'v1',
          granted,
          ip_address: ip,
          user_agent: userAgent,
        }
      })
      .filter((row) => row.granted)

    if (consentRows.length > 0) {
      db.insert(leadConsents).values(consentRows).catch(console.error)
    }
  }

  // Async: enrich IP + dispatch webhooks + WhatsApp alert
  let selectedTemplate: typeof emailTemplates.$inferSelect | null = null
  if (email && form.email_template_id) {
    const [templateRow] = await db
      .select()
      .from(emailTemplates)
      .where(and(eq(emailTemplates.id, form.email_template_id), eq(emailTemplates.workspace_id, form.workspace_id!)))
      .limit(1)
    selectedTemplate = templateRow ?? null

    if (!selectedTemplate) {
      db.insert(opsAlerts).values({
        workspace_id: form.workspace_id!,
        source: 'email_dispatch',
        severity: 'warning',
        title: 'Template de e-mail não encontrado',
        message: `Form ${form.id} referencia um template inexistente.`,
        payload: { form_id: form.id, email_template_id: form.email_template_id },
      }).catch(console.error)
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const unsubscribeAbsolute = email
    ? buildUnsubscribeUrl(appUrl, form.workspace_id!, email)
    : null
  const emailDispatchPromise = email
    ? enqueueEmailDispatch({
        workspaceId: form.workspace_id!,
        leadId: lead.id,
        templateId: selectedTemplate?.id ?? null,
        recipientEmail: email,
        subject: selectedTemplate?.subject ?? `Recebemos seu contato - ${form.name}`,
        blocks: Array.isArray(selectedTemplate?.blocks) ? selectedTemplate!.blocks : [
          {
            id: 'lead_received_message',
            type: 'text',
            content: `${form.submit_message ?? 'Recebemos suas informações. Em breve entraremos em contato.'}\n\nLead: {{name}}\nEmail: {{email}}`,
          },
        ],
        variables: Object.entries(cleanData as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, value]) => {
          if (value === null || value === undefined) return acc
          acc[key] = String(value)
          return acc
        }, {
          email,
          name: typeof cleanData.name === 'string' ? cleanData.name : 'Lead',
          form_name: form.name,
          submit_message: form.submit_message ?? '',
          utm_source: utmSource ?? '',
          created_at: new Date().toISOString(),
          unsubscribe_url: unsubscribeAbsolute ?? '',
          ...(selectedTemplate?.from_name ? { from_name: selectedTemplate.from_name } : {}),
          ...(selectedTemplate?.from_email ? { from_email: selectedTemplate.from_email } : {}),
          ...(selectedTemplate?.reply_to ? { reply_to: selectedTemplate.reply_to } : {}),
        }),
        triggerType: 'lead_received',
        emailType: 'transactional',
        idempotencyKey: `lead_received:${lead.id}:${email.toLowerCase()}:${selectedTemplate?.id ?? 'default'}`,
      })
        .then(() => processPendingEmailDispatches({ workspaceId: form.workspace_id!, limit: 25 }))
        .catch(console.error)
    : Promise.resolve(null)

  Promise.all([
    enrichLeadWithIP(lead.id, ip, userAgent),
    assignLeadByRoutingRules({
      workspaceId: form.workspace_id!,
      leadId: lead.id,
      data: cleanData as Record<string, unknown>,
      score: leadScore,
      utmSource,
      utmCampaign,
      region: null,
    }),
    dispatchWebhooksForLead(lead.id, formId, form.workspace_id ?? '', webhookPayload),
    notifyWhatsApp({
      workspaceId: form.workspace_id!,
      leadData: cleanData as Record<string, unknown>,
      score: leadScore,
    }),
    emailDispatchPromise,
  ]).catch(console.error)

  // Track A/B variant submission
  if (variantId) {
    recordVariantSubmission(variantId).catch(console.error)
  }

  return jsonWithCors({
    success: true,
    message: form.submit_message,
    redirect_url: form.submit_redirect_url,
  })
 } catch (err: unknown) {
    console.error('[submit] Unhandled error:', err instanceof Error ? err.stack : err)
    return jsonWithCors(
      { error: 'Não foi possível enviar no momento. Tente novamente em instantes.' },
      { status: 500 },
    )
  }
}

// CORS preflight for embeds
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  })
}
