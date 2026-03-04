import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { adConversionDispatches, opsAlerts, recoveryDispatchLogs, webhookDestinations, webhookLogs } from '@/lib/db/schema'
import { getOrCreateWorkspace } from '@/lib/db/queries/workspace'
import { and, desc, eq } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { OperationsActionsClient } from '@/components/workspace/OperationsActionsClient'

export default async function OperationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workspace = await getOrCreateWorkspace(user.id, user.email ?? 'user@example.com')

  const [alerts, adDispatches, recoveryLogs, webhooks] = await Promise.all([
    db.select().from(opsAlerts).where(eq(opsAlerts.workspace_id, workspace.id)).orderBy(desc(opsAlerts.created_at)).limit(20),
    db.select().from(adConversionDispatches).where(eq(adConversionDispatches.workspace_id, workspace.id)).orderBy(desc(adConversionDispatches.created_at)).limit(20),
    db.select().from(recoveryDispatchLogs).where(eq(recoveryDispatchLogs.workspace_id, workspace.id)).orderBy(desc(recoveryDispatchLogs.created_at)).limit(20),
    db
      .select({ log: webhookLogs })
      .from(webhookLogs)
      .leftJoin(webhookDestinations, eq(webhookLogs.destination_id, webhookDestinations.id))
      .where(and(eq(webhookDestinations.workspace_id, workspace.id)))
      .orderBy(desc(webhookLogs.created_at))
      .limit(20),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Operacoes</h1>
        <p className="text-muted-foreground">Saude operacional das integracoes e pipelines.</p>
      </div>

      <OperationsActionsClient />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Alertas</p><p className="mt-1 text-2xl font-semibold">{alerts.length}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Dispatch Ads</p><p className="mt-1 text-2xl font-semibold">{adDispatches.length}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Recovery Logs</p><p className="mt-1 text-2xl font-semibold">{recoveryLogs.length}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Webhook Logs</p><p className="mt-1 text-2xl font-semibold">{webhooks.length}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Ultimos alertas</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {alerts.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum alerta.</p> : alerts.map((alert) => (
            <div key={alert.id} className="rounded border p-2.5 text-xs">
              <p><strong>{alert.title}</strong></p>
              <p>{alert.message ?? '-'}</p>
              <p className="text-muted-foreground">{alert.created_at ? new Date(alert.created_at).toLocaleString('pt-BR') : '-'}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

