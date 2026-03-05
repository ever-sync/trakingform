import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { webhookDestinations } from '@/lib/db/schema'
import { getOrCreateWorkspace } from '@/lib/db/queries/workspace'
import { eq, desc } from 'drizzle-orm'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { WebhooksManagerClient } from '@/components/webhooks/WebhooksManagerClient'

export const dynamic = 'force-dynamic'

export default async function WebhooksPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const workspace = await getOrCreateWorkspace(user.id, user.email ?? 'user@example.com')

  const destinations = await db
    .select()
    .from(webhookDestinations)
    .where(eq(webhookDestinations.workspace_id, workspace.id))
    .orderBy(desc(webhookDestinations.created_at))
  const serializedDestinations = destinations.map((destination) => ({
    id: destination.id,
    name: destination.name,
    type: destination.type ?? 'generic',
    method: destination.method ?? 'POST',
    url: destination.url,
    is_active: destination.is_active,
    created_at: destination.created_at ? new Date(destination.created_at).toISOString() : null,
    updated_at: destination.updated_at ? new Date(destination.updated_at).toISOString() : null,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Webhooks</h1>
          <p className="text-muted-foreground">Roteie leads para sistemas externos</p>
        </div>
        <Button asChild className="bg-black hover:bg-gray-800">
          <Link href="/webhooks/new">
            <Plus className="mr-2 h-4 w-4" />
            Novo destino
          </Link>
        </Button>
      </div>
      <WebhooksManagerClient initialDestinations={serializedDestinations} />
    </div>
  )
}
