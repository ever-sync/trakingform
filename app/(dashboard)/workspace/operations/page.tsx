import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { adConversionDispatches, emailDispatches, opsAlerts, recoveryDispatchLogs, webhookDestinations, webhookLogs } from '@/lib/db/schema'
import { getOrCreateWorkspace } from '@/lib/db/queries/workspace'
import { and, desc, eq } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { OperationsActionsClient } from '@/components/workspace/OperationsActionsClient'
import { Badge } from '@/components/ui/badge'
import { getEmailMetrics } from '@/lib/services/email/dispatcher'

const numberFormatter = new Intl.NumberFormat('pt-BR')
const percentFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

function formatPercent(value: number) {
  return `${percentFormatter.format(value)}%`
}

function dispatchStatusLabel(status: string) {
  if (status === 'sent') return 'Enviado'
  if (status === 'failed') return 'Falhou'
  if (status === 'retrying') return 'Tentando'
  if (status === 'queued') return 'Na fila'
  if (status === 'processing') return 'Processando'
  if (status === 'skipped') return 'Ignorado'
  return status
}

function dispatchStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'sent') return 'default'
  if (status === 'failed') return 'destructive'
  if (status === 'retrying' || status === 'processing') return 'secondary'
  return 'outline'
}

export default async function OperationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workspace = await getOrCreateWorkspace(user.id, user.email ?? 'user@example.com')

  const [alerts, adDispatches, recoveryLogs, webhooks, recentEmailDispatches, emailMetrics] = await Promise.all([
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
    db.select().from(emailDispatches).where(eq(emailDispatches.workspace_id, workspace.id)).orderBy(desc(emailDispatches.created_at)).limit(20),
    getEmailMetrics(workspace.id),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Operacoes</h1>
        <p className="text-muted-foreground">Saude operacional das integracoes e pipelines.</p>
      </div>

      <OperationsActionsClient />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Alertas</p><p className="mt-1 text-2xl font-semibold">{alerts.length}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Dispatch Ads</p><p className="mt-1 text-2xl font-semibold">{adDispatches.length}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Recovery Logs</p><p className="mt-1 text-2xl font-semibold">{recoveryLogs.length}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Webhook Logs</p><p className="mt-1 text-2xl font-semibold">{webhooks.length}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Email Queue</p><p className="mt-1 text-2xl font-semibold">{numberFormatter.format(emailMetrics.totals.queued)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email health ({emailMetrics.window_days} dias)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">Dispatch total</p>
              <p className="mt-1 text-xl font-semibold">{numberFormatter.format(emailMetrics.totals.total)}</p>
            </div>
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">Taxa sucesso</p>
              <p className="mt-1 text-xl font-semibold">{formatPercent(emailMetrics.rates.success_rate)}</p>
            </div>
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">Open rate</p>
              <p className="mt-1 text-xl font-semibold">{formatPercent(emailMetrics.rates.open_rate)}</p>
            </div>
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">Click rate</p>
              <p className="mt-1 text-xl font-semibold">{formatPercent(emailMetrics.rates.click_rate)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded border p-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Sent</p>
              <p className="text-lg font-semibold">{numberFormatter.format(emailMetrics.totals.sent)}</p>
            </div>
            <div className="rounded border p-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Failed</p>
              <p className="text-lg font-semibold">{numberFormatter.format(emailMetrics.totals.failed)}</p>
            </div>
            <div className="rounded border p-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Retrying</p>
              <p className="text-lg font-semibold">{numberFormatter.format(emailMetrics.totals.retrying)}</p>
            </div>
            <div className="rounded border p-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Queued</p>
              <p className="text-lg font-semibold">{numberFormatter.format(emailMetrics.totals.queued)}</p>
            </div>
            <div className="rounded border p-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Bounce</p>
              <p className="text-lg font-semibold">{formatPercent(emailMetrics.rates.bounce_rate)}</p>
            </div>
            <div className="rounded border p-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Complaint</p>
              <p className="text-lg font-semibold">{formatPercent(emailMetrics.rates.complaint_rate)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded border p-3">
              <p className="text-sm font-semibold">Eventos do provedor</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <p className="text-muted-foreground">Opened</p>
                <p className="text-right font-medium">{numberFormatter.format(emailMetrics.events.opened)}</p>
                <p className="text-muted-foreground">Clicked</p>
                <p className="text-right font-medium">{numberFormatter.format(emailMetrics.events.clicked)}</p>
                <p className="text-muted-foreground">Bounced</p>
                <p className="text-right font-medium">{numberFormatter.format(emailMetrics.events.bounced)}</p>
                <p className="text-muted-foreground">Complained</p>
                <p className="text-right font-medium">{numberFormatter.format(emailMetrics.events.complained)}</p>
              </div>
            </div>

            <div className="rounded border p-3">
              <p className="text-sm font-semibold">Top erros</p>
              <div className="mt-2 space-y-2">
                {emailMetrics.top_errors.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem erros no periodo.</p>
                ) : (
                  emailMetrics.top_errors.map((item) => (
                    <div key={item.error} className="flex items-center justify-between gap-2 rounded border px-2 py-1.5">
                      <p className="line-clamp-1 text-xs text-muted-foreground">{item.error}</p>
                      <Badge variant="outline">{numberFormatter.format(item.count)}</Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ultimos dispatches de email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentEmailDispatches.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum dispatch registrado.</p>
          ) : (
            recentEmailDispatches.map((dispatch) => (
              <div key={dispatch.id} className="rounded border p-2.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Badge variant={dispatchStatusVariant(dispatch.status)}>{dispatchStatusLabel(dispatch.status)}</Badge>
                    <span className="truncate font-medium">{dispatch.recipient_email}</span>
                    <span className="text-muted-foreground">{dispatch.trigger_type}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {dispatch.updated_at ? new Date(dispatch.updated_at).toLocaleString('pt-BR') : '-'}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
                  <span>Tentativas: {dispatch.attempts ?? 0}</span>
                  <span>Provedor: {dispatch.provider ?? '-'}</span>
                  <span>Lead: {dispatch.lead_id ?? '-'}</span>
                </div>
                {dispatch.error ? <p className="mt-1 text-red-600">{dispatch.error}</p> : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

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

