import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { emailCampaigns, emailTemplates } from '@/lib/db/schema'
import { getRequestWorkspace } from '@/lib/api/auth-workspace'

export async function GET() {
  const { user, workspace } = await getRequestWorkspace()
  if (!user || !workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db
    .select({
      campaign: emailCampaigns,
      template: {
        id: emailTemplates.id,
        name: emailTemplates.name,
        subject: emailTemplates.subject,
      },
    })
    .from(emailCampaigns)
    .leftJoin(emailTemplates, eq(emailCampaigns.template_id, emailTemplates.id))
    .where(eq(emailCampaigns.workspace_id, workspace.id))
    .orderBy(desc(emailCampaigns.created_at))

  return NextResponse.json({
    campaigns: rows.map((row) => ({
      ...row.campaign,
      template: row.template && row.template.id ? row.template : null,
    })),
  })
}

export async function POST(req: NextRequest) {
  const { user, workspace } = await getRequestWorkspace()
  if (!user || !workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as {
    name?: string
    template_id?: string
    email_type?: 'transactional' | 'marketing'
    audience_filter?: Record<string, unknown>
    scheduled_at?: string | null
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 422 })
  }

  if (!body.template_id) {
    return NextResponse.json({ error: 'template_id is required' }, { status: 422 })
  }

  const [template] = await db
    .select({ id: emailTemplates.id })
    .from(emailTemplates)
    .where(and(eq(emailTemplates.id, body.template_id), eq(emailTemplates.workspace_id, workspace.id)))
    .limit(1)

  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  const [created] = await db
    .insert(emailCampaigns)
    .values({
      workspace_id: workspace.id,
      template_id: body.template_id,
      name: body.name.trim(),
      email_type: body.email_type ?? 'marketing',
      audience_filter: body.audience_filter ?? {},
      status: body.scheduled_at ? 'scheduled' : 'draft',
      scheduled_at: body.scheduled_at ? new Date(body.scheduled_at) : null,
      created_at: new Date(),
    })
    .returning()

  return NextResponse.json(created, { status: 201 })
}
