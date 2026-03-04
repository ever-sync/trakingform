import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { workspaceMembers } from '@/lib/db/schema'
import { getRequestWorkspace } from '@/lib/api/auth-workspace'

export async function GET() {
  const { user, workspace } = await getRequestWorkspace()
  if (!user || !workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const members = await db
    .select({
      id: workspaceMembers.id,
      user_id: workspaceMembers.user_id,
      email: workspaceMembers.email,
      role: workspaceMembers.role,
      accepted_at: workspaceMembers.accepted_at,
    })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspace_id, workspace.id))

  return NextResponse.json({ members })
}
