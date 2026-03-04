import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { emailTemplates } from '@/lib/db/schema'
import { getOrCreateWorkspace } from '@/lib/db/queries/workspace'
import { eq, and } from 'drizzle-orm'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getOrCreateWorkspace(user.id, user.email ?? '')

  await db.delete(emailTemplates).where(
    and(
      eq(emailTemplates.id, id),
      eq(emailTemplates.workspace_id, workspace.id),
    ),
  )

  return NextResponse.json({ ok: true })
}
