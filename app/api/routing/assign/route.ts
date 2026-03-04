import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { leadEnrichments, leads } from '@/lib/db/schema'
import { getRequestWorkspace } from '@/lib/api/auth-workspace'
import { assignLeadByRoutingRules } from '@/lib/services/routing/engine'

export async function POST(req: NextRequest) {
  const { user, workspace } = await getRequestWorkspace()
  if (!user || !workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json()) as { leadId?: string; dryRun?: boolean }
  if (!body.leadId) return NextResponse.json({ error: 'leadId is required' }, { status: 422 })

  const [lead] = await db
    .select({
      id: leads.id,
      workspace_id: leads.workspace_id,
      data: leads.data,
      score: leads.score,
      utm_source: leads.utm_source,
      utm_campaign: leads.utm_campaign,
    })
    .from(leads)
    .where(and(eq(leads.id, body.leadId), eq(leads.workspace_id, workspace.id)))
    .limit(1)

  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const [enrichment] = await db
    .select({ region: leadEnrichments.region })
    .from(leadEnrichments)
    .where(eq(leadEnrichments.lead_id, body.leadId))
    .limit(1)

  const leadData = (lead.data && typeof lead.data === 'object' && !Array.isArray(lead.data))
    ? lead.data as Record<string, unknown>
    : {}

  const result = await assignLeadByRoutingRules({
    workspaceId: workspace.id,
    leadId: body.leadId,
    data: leadData,
    score: lead.score ?? 0,
    utmSource: lead.utm_source,
    utmCampaign: lead.utm_campaign,
    region: enrichment?.region ?? null,
  }, {
    dryRun: body.dryRun === true,
  })

  return NextResponse.json(result)
}

