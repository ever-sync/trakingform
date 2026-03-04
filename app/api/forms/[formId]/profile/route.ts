import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { formId } = await params
  const body = await req.json() as { email?: string; fingerprint?: string }

  if (!body.email && !body.fingerprint) {
    return NextResponse.json({ known_fields: {} })
  }

  // Find the most recent lead for this form with matching email or fingerprint
  const allLeads = await db
    .select({ data: leads.data, id: leads.id })
    .from(leads)
    .where(eq(leads.form_id, formId))
    .orderBy(desc(leads.created_at))
    .limit(50)

  // Search for matching lead by email in data
  let matchedData: Record<string, unknown> | null = null

  for (const lead of allLeads) {
    const data = lead.data as Record<string, unknown> | null
    if (!data) continue

    if (body.email) {
      const leadEmail = String(data.email || data.e_mail || '').toLowerCase().trim()
      if (leadEmail === body.email.toLowerCase().trim()) {
        matchedData = data
        break
      }
    }
  }

  // Also try fingerprint match
  if (!matchedData && body.fingerprint) {
    const fpLeads = await db
      .select({ data: leads.data })
      .from(leads)
      .where(and(eq(leads.form_id, formId), eq(leads.fingerprint, body.fingerprint)))
      .orderBy(desc(leads.created_at))
      .limit(1)

    if (fpLeads[0]) {
      matchedData = fpLeads[0].data as Record<string, unknown>
    }
  }

  if (!matchedData) {
    return NextResponse.json({ known_fields: {} })
  }

  // Filter out internal fields
  const known_fields: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(matchedData)) {
    if (!key.startsWith('_') && value !== null && value !== undefined && String(value).trim()) {
      known_fields[key] = value
    }
  }

  return NextResponse.json({ known_fields })
}
