import { NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { leadConsents } from '@/lib/db/schema'
import { getRequestWorkspace } from '@/lib/api/auth-workspace'

export async function GET() {
  const { user, workspace } = await getRequestWorkspace()
  if (!user || !workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db
    .select()
    .from(leadConsents)
    .where(eq(leadConsents.workspace_id, workspace.id))
    .orderBy(desc(leadConsents.created_at))
    .limit(500)

  const exportRows = rows.map((row) => ({
    id: row.id,
    lead_id: row.lead_id,
    consent_key: row.consent_key,
    consent_version: row.consent_version,
    granted: row.granted,
    ip_address: row.ip_address,
    created_at: row.created_at,
  }))

  return NextResponse.json({
    total: rows.length,
    rows,
    export: exportRows,
  })
}

export async function POST(req: Request) {
  const { user, workspace } = await getRequestWorkspace()
  if (!user || !workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json()) as {
    lead_id?: string
    form_id?: string
    consent_key?: string
    consent_text?: string
    consent_version?: string
    granted?: boolean
    ip_address?: string
    user_agent?: string
  }

  if (!body.lead_id || !body.consent_key) {
    return NextResponse.json({ error: 'lead_id and consent_key are required' }, { status: 422 })
  }

  const [created] = await db
    .insert(leadConsents)
    .values({
      workspace_id: workspace.id,
      lead_id: body.lead_id,
      form_id: body.form_id ?? null,
      consent_key: body.consent_key,
      consent_text: body.consent_text ?? null,
      consent_version: body.consent_version ?? 'v1',
      granted: !!body.granted,
      ip_address: body.ip_address ?? null,
      user_agent: body.user_agent ?? null,
    })
    .returning()

  return NextResponse.json(created, { status: 201 })
}

