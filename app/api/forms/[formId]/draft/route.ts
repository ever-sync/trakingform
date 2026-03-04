import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { formSessionDrafts, forms } from '@/lib/db/schema'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { formId } = await params
  const body = (await req.json()) as {
    fingerprint?: string
    email?: string
    phone?: string
    data?: Record<string, unknown>
    progress_step?: number
  }

  const form = await db.query.forms.findFirst({
    where: eq(forms.id, formId),
    columns: { id: true, workspace_id: true },
  })

  if (!form || !form.workspace_id) {
    return NextResponse.json({ error: 'Form not found' }, { status: 404 })
  }

  const fingerprint = typeof body.fingerprint === 'string' ? body.fingerprint : null
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : null
  const phone = typeof body.phone === 'string' ? body.phone.trim() : null
  if (!fingerprint && !email) {
    return NextResponse.json({ skipped: true, reason: 'missing_identity' })
  }

  const identityFilter = fingerprint
    ? eq(formSessionDrafts.fingerprint, fingerprint)
    : eq(formSessionDrafts.email, email as string)

  const existing = await db
    .select({ id: formSessionDrafts.id })
    .from(formSessionDrafts)
    .where(and(
      eq(formSessionDrafts.form_id, formId),
      identityFilter
    ))
    .limit(1)

  if (existing[0]) {
    const [updated] = await db
      .update(formSessionDrafts)
      .set({
        email,
        phone,
        data: body.data ?? {},
        progress_step: Number.isFinite(body.progress_step) ? Math.max(0, Number(body.progress_step)) : 0,
        status: 'active',
        updated_at: new Date(),
      })
      .where(eq(formSessionDrafts.id, existing[0].id))
      .returning({ id: formSessionDrafts.id })

    return NextResponse.json({ draftId: updated.id, updated: true })
  }

  const [created] = await db
    .insert(formSessionDrafts)
    .values({
      workspace_id: form.workspace_id,
      form_id: formId,
      fingerprint,
      email,
      phone,
      data: body.data ?? {},
      progress_step: Number.isFinite(body.progress_step) ? Math.max(0, Number(body.progress_step)) : 0,
      status: 'active',
    })
    .returning({ id: formSessionDrafts.id })

  return NextResponse.json({ draftId: created.id, created: true }, { status: 201 })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { formId } = await params
  const body = (await req.json()) as { draftId?: string }

  if (!body.draftId) {
    return NextResponse.json({ error: 'draftId is required' }, { status: 422 })
  }

  const [draft] = await db
    .update(formSessionDrafts)
    .set({ resumed_at: new Date(), status: 'resumed', updated_at: new Date() })
    .where(and(
      eq(formSessionDrafts.id, body.draftId),
      eq(formSessionDrafts.form_id, formId)
    ))
    .returning({
      id: formSessionDrafts.id,
      data: formSessionDrafts.data,
      progress_step: formSessionDrafts.progress_step,
    })

  if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  return NextResponse.json({ draft })
}

