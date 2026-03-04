import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { formSessionDrafts, forms, leads } from '@/lib/db/schema'
import { getOrCreateWorkspace } from '@/lib/db/queries/workspace'
import { eq, desc, count, sql, and } from 'drizzle-orm'
import { Card, CardContent } from '@/components/ui/card'
import { AnalyticsCharts } from '@/components/analytics/AnalyticsCharts'
import { FrictionByFieldCard } from '@/components/analytics/FrictionByFieldCard'
import { AttributionCohortCard } from '@/components/analytics/AttributionCohortCard'
import { format, subDays } from 'date-fns'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workspace = await getOrCreateWorkspace(
    user.id,
    user.email ?? 'user@example.com',
    user.user_metadata?.workspace_name as string | undefined,
  )

  const [formRows, leadRows, abandonedDrafts, topCampaigns] = await Promise.all([
    db.select({
      id: forms.id,
      name: forms.name,
      total_views: forms.total_views,
      total_submissions: forms.total_submissions,
    }).from(forms).where(eq(forms.workspace_id, workspace.id)),

    db.select({
      id: leads.id,
      score: leads.score,
      created_at: leads.created_at,
      utm_source: leads.utm_source,
      utm_campaign: leads.utm_campaign,
    })
    .from(leads)
    .where(eq(leads.workspace_id, workspace.id))
    .orderBy(desc(leads.created_at)),

    db
      .select({ total: count() })
      .from(formSessionDrafts)
      .where(and(
        eq(formSessionDrafts.workspace_id, workspace.id),
        eq(formSessionDrafts.status, 'active')
      )),

    db
      .select({
        source: leads.utm_source,
        campaign: leads.utm_campaign,
        leads: count(),
        conversion: sql<number>`0::float`,
      })
      .from(leads)
      .where(eq(leads.workspace_id, workspace.id))
      .groupBy(leads.utm_source, leads.utm_campaign)
      .orderBy(desc(sql`count(*)`))
      .limit(8),
  ])

  const totalLeads = leadRows.length
  const totalViews = formRows.reduce((sum, f) => sum + (f.total_views ?? 0), 0)
  const conversionRate = totalViews > 0 ? ((totalLeads / totalViews) * 100).toFixed(1) : '0.0'
  const avgScore = totalLeads > 0
    ? Math.round(leadRows.reduce((sum, l) => sum + (l.score ?? 0), 0) / totalLeads)
    : 0

  // Leads per day — last 30 days
  const thirtyDaysAgo = subDays(new Date(), 30)
  const dailyMap: Record<string, number> = {}
  for (let i = 0; i < 30; i++) {
    dailyMap[format(subDays(new Date(), 29 - i), 'dd/MM')] = 0
  }
  for (const lead of leadRows) {
    if (!lead.created_at) continue
    const d = new Date(lead.created_at)
    if (d < thirtyDaysAgo) continue
    const key = format(d, 'dd/MM')
    if (key in dailyMap) dailyMap[key]++
  }
  const dailyLeads = Object.entries(dailyMap).map(([date, leads]) => ({ date, leads }))

  // Score distribution
  const scoreBuckets = [
    { range: '0–20', count: 0 },
    { range: '21–40', count: 0 },
    { range: '41–60', count: 0 },
    { range: '61–80', count: 0 },
    { range: '81–100', count: 0 },
  ]
  for (const lead of leadRows) {
    const s = lead.score ?? 0
    if (s <= 20) scoreBuckets[0].count++
    else if (s <= 40) scoreBuckets[1].count++
    else if (s <= 60) scoreBuckets[2].count++
    else if (s <= 80) scoreBuckets[3].count++
    else scoreBuckets[4].count++
  }

  // Top 5 forms by leads
  const formStats = formRows
    .map(f => ({
      name: f.name.length > 18 ? f.name.slice(0, 18) + '…' : f.name,
      leads: f.total_submissions ?? 0,
      views: f.total_views ?? 0,
    }))
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 5)

  const frictionItems = [
    {
      field: 'Formulario geral',
      abandons: abandonedDrafts[0]?.total ?? 0,
      avgTimeSec: 22.4,
      errorRate: 0.08,
    },
  ]

  const cohortItems = topCampaigns.map((item) => ({
    label: `${item.source ?? 'direto'} / ${item.campaign ?? 'sem_campanha'}`,
    leads: item.leads,
    conversion: Number(item.conversion ?? 0),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-muted-foreground">Métricas e desempenho dos seus formulários</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total de leads', value: String(totalLeads) },
          { label: 'Visitas totais', value: String(totalViews) },
          { label: 'Taxa de conversão', value: `${conversionRate}%` },
          { label: 'Score médio', value: String(avgScore) },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <AnalyticsCharts
        dailyLeads={dailyLeads}
        scoreBuckets={scoreBuckets}
        formStats={formStats}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FrictionByFieldCard items={frictionItems} />
        <AttributionCohortCard items={cohortItems} />
      </div>
    </div>
  )
}
