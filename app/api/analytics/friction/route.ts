import { NextResponse } from 'next/server'
import { and, count, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { forms, formSessionDrafts, leads } from '@/lib/db/schema'
import { getRequestWorkspace } from '@/lib/api/auth-workspace'

export async function GET() {
  const { user, workspace } = await getRequestWorkspace()
  if (!user || !workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formStats = await db
    .select({
      id: forms.id,
      name: forms.name,
      views: forms.total_views,
      submissions: forms.total_submissions,
    })
    .from(forms)
    .where(eq(forms.workspace_id, workspace.id))

  const [abandonedDrafts] = await db
    .select({ total: count() })
    .from(formSessionDrafts)
    .where(and(
      eq(formSessionDrafts.workspace_id, workspace.id),
      eq(formSessionDrafts.status, 'active')
    ))

  const topCampaigns = await db
    .select({
      campaign: leads.utm_campaign,
      total: count(),
    })
    .from(leads)
    .where(eq(leads.workspace_id, workspace.id))
    .groupBy(leads.utm_campaign)
    .orderBy(desc(sql`count(*)`))
    .limit(10)

  return NextResponse.json({
    abandonedDrafts: abandonedDrafts?.total ?? 0,
    formStats,
    topCampaigns,
  })
}

