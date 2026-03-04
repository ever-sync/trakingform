import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { getRequestWorkspace } from '@/lib/api/auth-workspace'
import { db } from '@/lib/db'
import { emailSuppressions } from '@/lib/db/schema'

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function parsePositiveInt(value: string | null, fallback: number, max: number) {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.max(1, Math.min(max, Math.floor(num)))
}

export async function GET(req: NextRequest) {
  const { user, workspace } = await getRequestWorkspace()
  if (!user || !workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const status = req.nextUrl.searchParams.get('status') ?? 'all'
  const page = parsePositiveInt(req.nextUrl.searchParams.get('page'), 1, 10_000)
  const pageSize = parsePositiveInt(req.nextUrl.searchParams.get('pageSize'), 25, 100)

  const whereConditions = [eq(emailSuppressions.workspace_id, workspace.id)]

  if (status === 'active') {
    whereConditions.push(eq(emailSuppressions.is_active, true))
  } else if (status === 'inactive') {
    whereConditions.push(eq(emailSuppressions.is_active, false))
  }

  if (q) {
    whereConditions.push(
      or(
        ilike(emailSuppressions.email, `%${q}%`),
        ilike(emailSuppressions.reason, `%${q}%`),
        ilike(emailSuppressions.source, `%${q}%`)
      )!
    )
  }

  const [totalRow, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(emailSuppressions)
      .where(and(...whereConditions)),
    db
      .select()
      .from(emailSuppressions)
      .where(and(...whereConditions))
      .orderBy(desc(emailSuppressions.updated_at), desc(emailSuppressions.created_at))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ])

  const total = totalRow[0]?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return NextResponse.json({
    items: rows,
    meta: {
      total,
      page,
      pageSize,
      totalPages,
    },
  })
}

export async function POST(req: NextRequest) {
  const { user, workspace } = await getRequestWorkspace()
  if (!user || !workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as {
    email?: string
    reason?: string | null
    source?: string | null
    is_active?: boolean
  }

  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : ''
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : 'manual'
  const source = typeof body.source === 'string' && body.source.trim() ? body.source.trim() : 'workspace_ui'
  const isActive = body.is_active !== false

  const [row] = await db
    .insert(emailSuppressions)
    .values({
      workspace_id: workspace.id,
      email,
      reason,
      source,
      is_active: isActive,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .onConflictDoUpdate({
      target: [emailSuppressions.workspace_id, emailSuppressions.email],
      set: {
        reason,
        source,
        is_active: isActive,
        updated_at: new Date(),
      },
    })
    .returning()

  return NextResponse.json({ item: row })
}

export async function PATCH(req: NextRequest) {
  const { user, workspace } = await getRequestWorkspace()
  if (!user || !workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as {
    id?: string
    is_active?: boolean
    reason?: string | null
    source?: string | null
  }

  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const [row] = await db
    .update(emailSuppressions)
    .set({
      is_active: body.is_active,
      reason: typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : undefined,
      source: typeof body.source === 'string' && body.source.trim() ? body.source.trim() : undefined,
      updated_at: new Date(),
    })
    .where(and(eq(emailSuppressions.id, body.id), eq(emailSuppressions.workspace_id, workspace.id)))
    .returning()

  if (!row) return NextResponse.json({ error: 'Suppression not found' }, { status: 404 })
  return NextResponse.json({ item: row })
}

export async function DELETE(req: NextRequest) {
  const { user, workspace } = await getRequestWorkspace()
  if (!user || !workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as {
    id?: string
    email?: string
  }

  if (!body.id && !body.email) {
    return NextResponse.json({ error: 'id or email is required' }, { status: 400 })
  }

  let rows: Array<{ id: string }>
  if (body.id) {
    rows = await db
      .update(emailSuppressions)
      .set({
        is_active: false,
        reason: 'reactivated_by_workspace',
        source: 'workspace_ui',
        updated_at: new Date(),
      })
      .where(and(eq(emailSuppressions.id, body.id), eq(emailSuppressions.workspace_id, workspace.id)))
      .returning({ id: emailSuppressions.id })
  } else {
    rows = await db
      .update(emailSuppressions)
      .set({
        is_active: false,
        reason: 'reactivated_by_workspace',
        source: 'workspace_ui',
        updated_at: new Date(),
      })
      .where(and(
        eq(emailSuppressions.workspace_id, workspace.id),
        eq(emailSuppressions.email, normalizeEmail(body.email!))
      ))
      .returning({ id: emailSuppressions.id })
  }

  return NextResponse.json({ updated: rows.length })
}
