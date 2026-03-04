import { createClient } from '@/lib/supabase/server'
import { getOrCreateWorkspace } from '@/lib/db/queries/workspace'

export async function getRequestWorkspace() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { user: null, workspace: null }

  const workspace = await getOrCreateWorkspace(
    user.id,
    user.email ?? 'user@example.com',
    user.user_metadata?.workspace_name as string | undefined,
  )

  return { user, workspace }
}

