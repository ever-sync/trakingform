import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { forms } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { getWorkspaceForUser } from '@/lib/db/queries/workspace'
import { applyWinnerVariant } from '@/lib/services/ab-test'

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { formId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await getFormWithAuth(formId, user.id)
  if (!form) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = (await req.json()) as { winnerVariantId?: string }
  if (!body.winnerVariantId) {
    return NextResponse.json({ error: 'winnerVariantId is required' }, { status: 422 })
  }

  const result = await applyWinnerVariant({
    formId,
    winnerVariantId: body.winnerVariantId,
    source: 'manual',
    actorUserId: user.id,
    actorEmail: user.email ?? null,
  })

  if (!result.applied) {
    return NextResponse.json({ error: 'Unable to apply winner' }, { status: 422 })
  }

  return NextResponse.json(result)
}
