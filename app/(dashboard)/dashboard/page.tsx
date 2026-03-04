import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { forms, leads, formVariants } from '@/lib/db/schema'
import { getOrCreateWorkspace } from '@/lib/db/queries/workspace'
import { desc, eq } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, FileText, TrendingUp, Zap, ExternalLink } from 'lucide-react'
import { ABVariantsCard } from '@/components/dashboard/ABVariantsCard'

function extractContact(data: unknown) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { name: 'Lead sem nome', email: '-' }
  }

  const record = data as Record<string, unknown>
  const name =
    (typeof record.name === 'string' && record.name.trim()) ||
    (typeof record.nome === 'string' && record.nome.trim()) ||
    (typeof record.full_name === 'string' && record.full_name.trim()) ||
    'Lead sem nome'
  const email = (typeof record.email === 'string' && record.email.trim()) || '-'

  return { name, email }
}

function extractUtmSource(data: unknown): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const record = data as Record<string, unknown>
  if (typeof record.utm_source === 'string' && record.utm_source.trim()) return record.utm_source.trim()
  if (typeof record._utm_source === 'string' && record._utm_source.trim()) return record._utm_source.trim()
  return null
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const workspace = await getOrCreateWorkspace(
    user.id,
    user.email ?? 'user@example.com',
    user.user_metadata?.workspace_name as string | undefined,
  )

  const [formRows, leadRows, variantRows] = await Promise.all([
    db.select().from(forms).where(eq(forms.workspace_id, workspace.id)),
    db
      .select({
        id: leads.id,
        created_at: leads.created_at,
        data: leads.data,
        variant_id: leads.variant_id,
      })
      .from(leads)
      .where(eq(leads.workspace_id, workspace.id))
      .orderBy(desc(leads.created_at)),
    db
      .select({
        id: formVariants.id,
        name: formVariants.name,
        form_id: formVariants.form_id,
        total_views: formVariants.total_views,
        total_submissions: formVariants.total_submissions,
        form_name: forms.name,
      })
      .from(formVariants)
      .innerJoin(forms, eq(formVariants.form_id, forms.id))
      .where(eq(forms.workspace_id, workspace.id))
      .orderBy(desc(formVariants.total_submissions)),
  ])

  const totalLeads = leadRows.length
  const totalForms = formRows.length
  const activeForms = formRows.filter((form) => form.is_active).length
  const totalViews = formRows.reduce((acc, form) => acc + (form.total_views ?? 0), 0)
  const conversionRate = totalViews > 0 ? ((totalLeads / totalViews) * 100).toFixed(1) : '0.0'

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const leadsToday = leadRows.filter((lead) => lead.created_at && new Date(lead.created_at) >= startOfDay).length

  const stats = [
    { title: 'Total de Leads', value: String(totalLeads), icon: Users, trend: `${leadsToday} hoje` },
    { title: 'Formulários Ativos', value: String(activeForms), icon: FileText, trend: `${totalForms} no total` },
    { title: 'Taxa de Conversão', value: `${conversionRate}%`, icon: TrendingUp, trend: `${totalViews} visitas` },
    { title: 'Leads Hoje', value: String(leadsToday), icon: Zap, trend: 'Atualizado em tempo real' },
  ]

  const recentLeads = leadRows.slice(0, 5)
  const topSources = Object.entries(
    leadRows.reduce<Record<string, number>>((acc, lead) => {
      const source = extractUtmSource(lead.data)
      if (!source) return acc
      acc[source] = (acc[source] ?? 0) + 1
      return acc
    }, {})
  )
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const now = Date.now()
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000

  const submissionCounters = leadRows.reduce<Record<string, { sevenDays: number; thirtyDays: number }>>((acc, lead) => {
    if (!lead.variant_id) return acc
    const createdAtMs = lead.created_at ? new Date(lead.created_at).getTime() : 0
    if (!acc[lead.variant_id]) {
      acc[lead.variant_id] = { sevenDays: 0, thirtyDays: 0 }
    }
    if (createdAtMs >= thirtyDaysAgo) {
      acc[lead.variant_id].thirtyDays += 1
      if (createdAtMs >= sevenDaysAgo) {
        acc[lead.variant_id].sevenDays += 1
      }
    }
    return acc
  }, {})

  const variantMetrics = variantRows.map((variant) => {
    const counters = submissionCounters[variant.id] ?? { sevenDays: 0, thirtyDays: 0 }
    return {
      id: variant.id,
      name: variant.name,
      form_id: variant.form_id,
      form_name: variant.form_name ?? 'Formulario',
      total_views: variant.total_views ?? 0,
      total_submissions: variant.total_submissions ?? 0,
      submissions_7d: counters.sevenDays,
      submissions_30d: counters.thirtyDays,
    }
  })

  const formOptions = formRows.map((form) => ({ id: form.id, name: form.name }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-muted-foreground">Bem-vindo de volta, {user.email}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="mt-1 text-xs text-muted-foreground">{stat.trend}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leads recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {recentLeads.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhum lead capturado ainda.{' '}
                <Link href="/forms/new" className="text-indigo-600 hover:underline">
                  Crie seu primeiro formulário
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentLeads.map((lead) => {
                  const contact = extractContact(lead.data)
                  return (
                    <div key={lead.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-gray-900">{contact.name}</p>
                        {extractUtmSource(lead.data) && (
                          <span className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">
                            {extractUtmSource(lead.data)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{contact.email}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {lead.created_at ? new Date(lead.created_at).toLocaleString('pt-BR') : '-'}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leads por formulário</CardTitle>
          </CardHeader>
          <CardContent>
            {formRows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Sem dados ainda.</div>
            ) : (
              <div className="space-y-2">
                {formRows.slice(0, 6).map((form) => (
                  <div key={form.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span className="truncate pr-3">{form.name}</span>
                    <span className="font-medium">{form.total_submissions ?? 0}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-1.5">
              <ExternalLink className="h-4 w-4" />
              Top Fontes (UTM)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topSources.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhuma fonte rastreada ainda. Adicione <code className="text-xs">?utm_source=...</code> às suas URLs.
              </div>
            ) : (
              <div className="space-y-2">
                {topSources.map((source) => (
                  <div key={source.source} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span className="truncate pr-3 font-medium">{source.source}</span>
                    <span className="text-muted-foreground">{source.count} leads</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <ABVariantsCard variants={variantMetrics} forms={formOptions} />
      </div>
    </div>
  )
}
