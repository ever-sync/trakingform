import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { forms, leads, workspaceMembers } from '@/lib/db/schema'
import { getOrCreateWorkspace } from '@/lib/db/queries/workspace'
import { desc, eq, and, gte, sql, count } from 'drizzle-orm'
import {
  ConversionGauge,
  RecentLeadsList,
  PerformanceChart,
  TopFormsWidget,
  PipelineStatusWidget,
  PendingLeadsList
} from '@/components/dashboard/ModernWidgets'

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

function classifySource(utmSource: string | null): string {
  if (!utmSource) return 'direct'
  const s = utmSource.toLowerCase()
  if (s.includes('google')) return 'google'
  if (s.includes('meta') || s.includes('facebook') || s.includes('instagram')) return 'meta'
  if (s === 'direct' || s === '') return 'direct'
  return 'organic'
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

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  // Run all queries in parallel
  const [
    formRows,
    recentLeadRows,
    pendingLeadRows,
    statusCounts,
    last7DaysLeads,
    members,
  ] = await Promise.all([
    // All forms (lightweight - just stats)
    db.select({
      id: forms.id,
      name: forms.name,
      total_views: forms.total_views,
      total_submissions: forms.total_submissions,
    }).from(forms).where(eq(forms.workspace_id, workspace.id)),

    // Recent 4 leads
    db.select()
      .from(leads)
      .where(eq(leads.workspace_id, workspace.id))
      .orderBy(desc(leads.created_at))
      .limit(4),

    // Pending leads (status = new, top 3 by score)
    db.select()
      .from(leads)
      .where(and(
        eq(leads.workspace_id, workspace.id),
        eq(leads.status, 'new')
      ))
      .orderBy(desc(leads.score))
      .limit(3),

    // Count by status
    db.select({
      status: leads.status,
      count: count(),
    })
      .from(leads)
      .where(eq(leads.workspace_id, workspace.id))
      .groupBy(leads.status),

    // Last 7 days leads (for chart)
    db.select({
      created_at: leads.created_at,
      utm_source: leads.utm_source,
    })
      .from(leads)
      .where(and(
        eq(leads.workspace_id, workspace.id),
        gte(leads.created_at, sevenDaysAgo)
      )),

    // Workspace members
    db.select({
      email: workspaceMembers.email,
      role: workspaceMembers.role,
    })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspace_id, workspace.id)),
  ])

  // Process metrics
  const totalLeads = statusCounts.reduce((acc, row) => acc + row.count, 0)
  const totalViews = formRows.reduce((acc, form) => acc + (form.total_views ?? 0), 0)
  const conversionPercentage = totalViews > 0 ? Math.round((totalLeads / totalViews) * 100) : 0

  // Recent leads
  const recentLeads = recentLeadRows.map(lead => {
    const contact = extractContact(lead.data)
    return {
      id: lead.id,
      name: contact.name,
      score: lead.score ?? 0,
      status: lead.status ?? 'new'
    }
  })

  // Pending leads (for new widget)
  const pendingLeads = pendingLeadRows.map(lead => {
    const contact = extractContact(lead.data)
    return {
      id: lead.id,
      name: contact.name,
      score: lead.score ?? 0,
      createdAt: lead.created_at?.toISOString() ?? new Date().toISOString(),
    }
  })

  // Chart data: group by day and source
  const dayNames = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
  const chartMap = new Map<string, { organic: number; google: number; meta: number; direct: number }>()

  // Initialize last 7 days
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    chartMap.set(key, { organic: 0, google: 0, meta: 0, direct: 0 })
  }

  for (const lead of last7DaysLeads) {
    if (!lead.created_at) continue
    const key = lead.created_at.toISOString().slice(0, 10)
    const bucket = chartMap.get(key)
    if (!bucket) continue
    const source = classifySource(lead.utm_source)
    bucket[source as keyof typeof bucket]++
  }

  const chartData = Array.from(chartMap.entries()).map(([dateStr, counts]) => {
    const d = new Date(dateStr)
    return {
      day: dayNames[d.getDay()],
      organic: counts.organic,
      google: counts.google,
      meta: counts.meta,
      direct: counts.direct,
    }
  })

  // Top forms
  const topForms = formRows
    .map(f => ({
      name: f.name,
      submissions: f.total_submissions ?? 0,
      conversion: f.total_views ? ((f.total_submissions ?? 0) / f.total_views * 100).toFixed(1) : '0'
    }))
    .sort((a, b) => b.submissions - a.submissions)
    .slice(0, 3)

  // Pipeline status
  const statusMap = Object.fromEntries(statusCounts.map(r => [r.status, r.count]))
  const newCount = statusMap['new'] ?? 0
  const contactedCount = statusMap['contacted'] ?? 0
  const qualifiedCount = (statusMap['qualified'] ?? 0) + (statusMap['converted'] ?? 0)

  // Team members
  const teamMembers = members.map(m => ({
    email: m.email,
    initials: m.email.slice(0, 2).toUpperCase(),
  }))

  return (
    <div className="flex flex-col gap-8 w-full max-w-[1600px] mx-auto pb-12">

      {/* ROW 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-7 w-full">
        <div className="lg:col-span-3 min-h-[380px]">
          <ConversionGauge percentage={conversionPercentage} total={totalLeads} />
        </div>
        <div className="lg:col-span-4 min-h-[380px]">
          <RecentLeadsList leads={recentLeads} />
        </div>
        <div className="lg:col-span-5 min-h-[380px]">
          <PerformanceChart data={chartData} />
        </div>
      </div>

      {/* ROW 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-7 w-full">
         <div className="lg:col-span-3 min-h-[340px]">
           <TopFormsWidget forms={topForms} />
         </div>
         <div className="lg:col-span-6 min-h-[340px]">
            <PipelineStatusWidget
              total={totalLeads}
              newCount={newCount}
              contacted={contactedCount}
              qualified={qualifiedCount}
              members={teamMembers}
            />
         </div>
         <div className="lg:col-span-3 min-h-[340px]">
            <PendingLeadsList leads={pendingLeads} />
         </div>
      </div>

    </div>
  )
}
