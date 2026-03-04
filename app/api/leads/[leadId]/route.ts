import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { leads, leadEnrichments, leadEvents, forms, workspaceMembers } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'

function extractUtm(data: unknown) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      utm_source: null as string | null,
      utm_medium: null as string | null,
      utm_campaign: null as string | null,
      referrer: null as string | null,
    }
  }

  const record = data as Record<string, unknown>
  return {
    utm_source:
      (typeof record.utm_source === 'string' && record.utm_source.trim()) ||
      (typeof record._utm_source === 'string' && record._utm_source.trim()) ||
      null,
    utm_medium:
      (typeof record.utm_medium === 'string' && record.utm_medium.trim()) ||
      (typeof record._utm_medium === 'string' && record._utm_medium.trim()) ||
      null,
    utm_campaign:
      (typeof record.utm_campaign === 'string' && record.utm_campaign.trim()) ||
      (typeof record._utm_campaign === 'string' && record._utm_campaign.trim()) ||
      null,
    referrer:
      (typeof record.referrer === 'string' && record.referrer.trim()) ||
      (typeof record._referrer === 'string' && record._referrer.trim()) ||
      null,
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const { leadId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get lead with form name
  const leadResult = await db
    .select({
      id: leads.id,
      data: leads.data,
      status: leads.status,
      score: leads.score,
      is_duplicate: leads.is_duplicate,
      ip_address: leads.ip_address,
      time_to_complete_seconds: leads.time_to_complete_seconds,
      created_at: leads.created_at,
      workspace_id: leads.workspace_id,
      form_name: forms.name,
    })
    .from(leads)
    .leftJoin(forms, eq(leads.form_id, forms.id))
    .where(eq(leads.id, leadId))
    .limit(1)

  const lead = leadResult[0]
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Verify workspace access
  const membership = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(and(
      eq(workspaceMembers.workspace_id, lead.workspace_id!),
      eq(workspaceMembers.user_id, user.id)
    ))
    .limit(1)

  if (membership.length === 0) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Get enrichment
  const enrichment = await db
    .select()
    .from(leadEnrichments)
    .where(eq(leadEnrichments.lead_id, leadId))
    .limit(1)

  // Get events
  const events = await db
    .select()
    .from(leadEvents)
    .where(eq(leadEvents.lead_id, leadId))
    .orderBy(desc(leadEvents.created_at))

  const utm = extractUtm(lead.data)

  return NextResponse.json({
    ...lead,
    ...utm,
    enrichment: enrichment[0] ?? null,
    events,
  })
}
