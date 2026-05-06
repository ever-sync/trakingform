import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { forms, leads } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { isFormOriginAllowed } from '@/lib/security/form-origin'
import { getFormProfileRatelimit } from '@/lib/services/form-public-ratelimit'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { formId } = await params
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'

  const limiter = getFormProfileRatelimit()
  if (limiter) {
    const { success } = await limiter.limit(`form-profile:${formId}:${ip}`)
    if (!success) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Aguarde um minuto e tente novamente.' },
        { status: 429 },
      )
    }
  }

  const form = await db.query.forms.findFirst({
    where: eq(forms.id, formId),
    columns: { id: true, allowed_domains: true, is_active: true },
  })

  if (!form || !form.is_active) {
    return NextResponse.json({ error: 'Formulário não encontrado ou indisponível.' }, { status: 404 })
  }

  const allowed = form.allowed_domains as string[] | null | undefined
  if (!isFormOriginAllowed(req, allowed)) {
    return NextResponse.json(
      { error: 'Este site não está autorizado a usar este formulário.' },
      { status: 403 },
    )
  }

  const body = (await req.json()) as { email?: string; fingerprint?: string }

  if (!body.email && !body.fingerprint) {
    return NextResponse.json({ known_fields: {} })
  }

  const allLeads = await db
    .select({ data: leads.data, id: leads.id })
    .from(leads)
    .where(eq(leads.form_id, formId))
    .orderBy(desc(leads.created_at))
    .limit(50)

  let matchedData: Record<string, unknown> | null = null

  for (const lead of allLeads) {
    const data = lead.data as Record<string, unknown> | null
    if (!data) continue

    if (body.email) {
      const leadEmail = String(data.email || data.e_mail || '').toLowerCase().trim()
      if (leadEmail === body.email.toLowerCase().trim()) {
        matchedData = data
        break
      }
    }
  }

  if (!matchedData && body.fingerprint) {
    const fpLeads = await db
      .select({ data: leads.data })
      .from(leads)
      .where(and(eq(leads.form_id, formId), eq(leads.fingerprint, body.fingerprint)))
      .orderBy(desc(leads.created_at))
      .limit(1)

    if (fpLeads[0]) {
      matchedData = fpLeads[0].data as Record<string, unknown>
    }
  }

  if (!matchedData) {
    return NextResponse.json({ known_fields: {} })
  }

  const known_fields: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(matchedData)) {
    if (!key.startsWith('_') && value !== null && value !== undefined && String(value).trim()) {
      known_fields[key] = value
    }
  }

  return NextResponse.json({ known_fields })
}
