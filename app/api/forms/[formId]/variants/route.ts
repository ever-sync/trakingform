import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { forms, formVariants } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getWorkspaceForUser } from '@/lib/db/queries/workspace'

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

  const variants = await db
    .select()
    .from(formVariants)
    .where(eq(formVariants.form_id, formId))

  return NextResponse.json(variants)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { formId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await getFormWithAuth(formId, user.id)
  if (!form) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json() as {
    name: string
    fields?: unknown[]
    settings?: unknown
    theme?: unknown
    weight?: number
  }

  const [variant] = await db
    .insert(formVariants)
    .values({
      form_id: formId,
      name: body.name || 'Variante B',
      fields: body.fields ?? form.fields,
      settings: body.settings ?? form.settings,
      theme: body.theme ?? form.theme,
      weight: body.weight ?? 50,
    })
    .returning()

  return NextResponse.json(variant)
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

  const body = await req.json() as {
    variantId?: string
    name?: string
    fields?: unknown[]
    settings?: unknown
    theme?: unknown
    weight?: number
    is_active?: boolean
  }

  if (!body.variantId) {
    return NextResponse.json({ error: 'variantId is required' }, { status: 400 })
  }

  const updateData: Partial<typeof formVariants.$inferInsert> = {}
  if (body.name !== undefined) updateData.name = body.name
  if (body.fields !== undefined) updateData.fields = body.fields
  if (body.settings !== undefined) updateData.settings = body.settings
  if (body.theme !== undefined) updateData.theme = body.theme
  if (body.weight !== undefined) updateData.weight = body.weight
  if (body.is_active !== undefined) updateData.is_active = body.is_active

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const [updated] = await db
    .update(formVariants)
    .set(updateData)
    .where(and(eq(formVariants.id, body.variantId), eq(formVariants.form_id, formId)))
    .returning()

  if (!updated) return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { formId } = await params
  const variantId = new URL(req.url).searchParams.get('variantId')
  if (!variantId) {
    return NextResponse.json({ error: 'variantId is required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await getFormWithAuth(formId, user.id)
  if (!form) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const deleted = await db
    .delete(formVariants)
    .where(and(eq(formVariants.id, variantId), eq(formVariants.form_id, formId)))
    .returning({ id: formVariants.id })

  if (deleted.length === 0) return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
  return NextResponse.json({ success: true, id: deleted[0].id })
}
