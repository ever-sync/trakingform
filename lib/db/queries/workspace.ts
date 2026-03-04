import { db } from '@/lib/db'
import { workspaces, workspaceMembers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function getWorkspaceForUser(userId: string) {
  const result = await db
    .select({ workspace: workspaces })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspace_id, workspaces.id))
    .where(eq(workspaceMembers.user_id, userId))
    .limit(1)

  return result[0]?.workspace ?? null
}

export async function getOrCreateWorkspace(
  userId: string,
  userEmail: string,
  workspaceName?: string
) {
  const existing = await getWorkspaceForUser(userId)
  if (existing) return existing

  const slug =
    userEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-') +
    '-' +
    Date.now().toString(36)

  const [workspace] = await db
    .insert(workspaces)
    .values({ name: workspaceName ?? userEmail.split('@')[0], slug })
    .returning()

  await db.insert(workspaceMembers).values({
    workspace_id: workspace.id,
    user_id: userId,
    email: userEmail,
    role: 'owner',
    accepted_at: new Date(),
  })

  return workspace
}
