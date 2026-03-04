import { NextRequest, NextResponse } from 'next/server'
import { and, eq, desc, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { forms, webhookDestinations, webhookRoutingRules } from '@/lib/db/schema'
import { getWorkspaceForUser } from '@/lib/db/queries/workspace'

async function getFormContext(formId: string, userId: string) {
  const workspace = await getWorkspaceForUser(userId)
  if (!workspace) return null

  const formRows = await db
    .select({ id: forms.id, workspace_id: forms.workspace_id })
    .from(forms)
    .where(and(eq(forms.id, formId), eq(forms.workspace_id, workspace.id)))
    .limit(1)

  if (formRows.length === 0) return null
  return { workspace, form: formRows[0] }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { formId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const context = await getFormContext(formId, user.id)
  if (!context) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const destinations = await db
    .select({
      id: webhookDestinations.id,
      name: webhookDestinations.name,
      type: webhookDestinations.type,
      method: webhookDestinations.method,
      url: webhookDestinations.url,
      is_active: webhookDestinations.is_active,
      created_at: webhookDestinations.created_at,
    })
    .from(webhookDestinations)
    .where(eq(webhookDestinations.workspace_id, context.workspace.id))
    .orderBy(desc(webhookDestinations.created_at))

  const selectedRules = await db
    .select({
      destination_id: webhookRoutingRules.destination_id,
    })
    .from(webhookRoutingRules)
    .where(
      and(
        eq(webhookRoutingRules.workspace_id, context.workspace.id),
        eq(webhookRoutingRules.form_id, formId),
        eq(webhookRoutingRules.is_active, true)
      )
    )

  const selectedDestinationIds = selectedRules
    .map((rule) => rule.destination_id)
    .filter((value): value is string => typeof value === 'string')

  return NextResponse.json({
    destinations,
    selectedDestinationIds,
  })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { formId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const context = await getFormContext(formId, user.id)
  if (!context) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = (await req.json()) as { selectedDestinationIds?: unknown }
  const selectedDestinationIds = Array.isArray(body.selectedDestinationIds)
    ? Array.from(new Set(body.selectedDestinationIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)))
    : []

  if (selectedDestinationIds.length > 0) {
    const availableRows = await db
      .select({ id: webhookDestinations.id })
      .from(webhookDestinations)
      .where(
        and(
          eq(webhookDestinations.workspace_id, context.workspace.id),
          inArray(webhookDestinations.id, selectedDestinationIds)
        )
      )

    const availableIds = new Set(availableRows.map((row) => row.id))
    const invalidIds = selectedDestinationIds.filter((id) => !availableIds.has(id))
    if (invalidIds.length > 0) {
      return NextResponse.json({ error: 'Webhook invalido para este workspace.' }, { status: 400 })
    }
  }

  await db
    .delete(webhookRoutingRules)
    .where(
      and(
        eq(webhookRoutingRules.workspace_id, context.workspace.id),
        eq(webhookRoutingRules.form_id, formId)
      )
    )

  if (selectedDestinationIds.length > 0) {
    await db.insert(webhookRoutingRules).values(
      selectedDestinationIds.map((destinationId, index) => ({
        workspace_id: context.workspace.id,
        destination_id: destinationId,
        form_id: formId,
        conditions: [],
        is_active: true,
        priority: index,
      }))
    )
  }

  revalidatePath(`/forms/${formId}/edit`)
  revalidatePath(`/forms/${formId}`)

  return NextResponse.json({
    success: true,
    selectedDestinationIds,
  })
}
