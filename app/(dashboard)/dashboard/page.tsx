import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { forms, leads } from '@/lib/db/schema'
import { getOrCreateWorkspace } from '@/lib/db/queries/workspace'
import { desc, eq } from 'drizzle-orm'
import {
  ConversionGauge,
  RecentLeadsList,
  PerformanceChart,
  TopFormsWidget,
  PipelineStatusWidget,
  FollowUpList
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

  const [formRows, leadRows] = await Promise.all([
    db.select().from(forms).where(eq(forms.workspace_id, workspace.id)),
    db
      .select()
      .from(leads)
      .where(eq(leads.workspace_id, workspace.id))
      .orderBy(desc(leads.created_at)),
  ])

  // Process data for widgets
  const totalLeads = leadRows.length
  const totalViews = formRows.reduce((acc, form) => acc + (form.total_views ?? 0), 0)
  const conversionPercentage = totalViews > 0 ? Math.round((totalLeads / totalViews) * 100) : 0

  // 1. Recent Leads
  const recentLeads = leadRows.slice(0, 4).map(lead => {
    const contact = extractContact(lead.data)
    return {
      id: lead.id,
      name: contact.name,
      score: lead.score ?? 50,
      status: lead.status ?? 'new'
    }
  })

  // 2. Mock line chart data (in real app, group leads by day)
  const chartData = [
    { day: 'MON', organic: 30, google: 50, meta: 20, direct: 10 },
    { day: 'TUE', organic: 45, google: 60, meta: 35, direct: 15 },
    { day: 'WED', organic: 60, google: 70, meta: 40, direct: 20 },
    { day: 'THU', organic: 50, google: 85, meta: 45, direct: 25 },
    { day: 'FRI', organic: 80, google: 90, meta: 50, direct: 40 },
    { day: 'SAT', organic: 90, google: 100, meta: 60, direct: 50 },
    { day: 'SUN', organic: 100, google: 110, meta: 80, direct: 60 },
  ]

  // 3. Top Forms
  const topForms = formRows
    .map(f => ({
      name: f.name,
      submissions: f.total_submissions ?? 0,
      conversion: f.total_views ? ((f.total_submissions ?? 0)/f.total_views*100).toFixed(1) : '0'
    }))
    .sort((a,b) => b.submissions - a.submissions)
    .slice(0, 3)

  // 4. Pipeline Status
  const newCount = leadRows.filter(l => l.status === 'new').length
  const contactedCount = leadRows.filter(l => l.status === 'contacted').length
  const qualifiedCount = leadRows.filter(l => l.status === 'qualified' || l.status === 'converted').length

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto pb-10">
      
      {/* ROW 1: Gauge (3 col) | Payroll (4 col) | Line Chart (5 col) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 w-full">
        
        {/* Gauge Widget */}
        <div className="lg:col-span-3 h-[380px]">
          <ConversionGauge percentage={conversionPercentage} total={totalLeads} />
        </div>

        {/* Recent Leads (Payroll style) */}
        <div className="lg:col-span-4 h-[380px]">
          <RecentLeadsList leads={recentLeads} />
        </div>

        {/* Performance Statistics (Line Chart) */}
        <div className="lg:col-span-5 h-[380px]">
          <PerformanceChart data={chartData} />
        </div>

      </div>

      {/* ROW 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 w-full">
         
         {/* Top Forms (Vacancies style) */}
         <div className="lg:col-span-3 h-[320px]">
           <TopFormsWidget forms={topForms} />
         </div>

         {/* Pipeline (Employment Status style) */}
         <div className="lg:col-span-6 h-[320px]">
            <PipelineStatusWidget 
              total={totalLeads} 
              newCount={newCount} 
              contacted={contactedCount} 
              qualified={qualifiedCount} 
            />
         </div>

         {/* Follow Ups (Meetings style) */}
         <div className="lg:col-span-3 h-[320px]">
            <FollowUpList />
         </div>

      </div>

    </div>
  )
}
