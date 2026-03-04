import { NextResponse } from 'next/server'
import { and, count, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { leadStageHistory, leads } from '@/lib/db/schema'
import { getRequestWorkspace } from '@/lib/api/auth-workspace'

export async function GET() {
  const { user, workspace } = await getRequestWorkspace()
  if (!user || !workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [totals] = await db
    .select({
      leads: count(),
      avgScore: sql<number>`coalesce(avg(${leads.score}), 0)::float`,
    })
    .from(leads)
    .where(eq(leads.workspace_id, workspace.id))

  const stageBreakdown = await db
    .select({
      stage: leads.status,
      total: count(),
    })
    .from(leads)
    .where(eq(leads.workspace_id, workspace.id))
    .groupBy(leads.status)

  const transitions = await db
    .select({
      to_stage: leadStageHistory.to_stage,
      total: count(),
    })
    .from(leadStageHistory)
    .where(eq(leadStageHistory.workspace_id, workspace.id))
    .groupBy(leadStageHistory.to_stage)

  return NextResponse.json({
    summary: {
      totalLeads: totals?.leads ?? 0,
      avgScore: Number(totals?.avgScore ?? 0),
    },
    stageBreakdown,
    transitions,
  })
}

