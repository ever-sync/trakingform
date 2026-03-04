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

function sanitizeCsvCell(value: unknown) {
  const raw = String(value ?? '')
  return `"${raw.replace(/"/g, '""')}"`
}

function parseEmailsInput(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input
      .filter((item) => typeof item === 'string')
      .map((item) => normalizeEmail(item))
      .filter((item) => item.length > 0)
  }

  if (typeof input === 'string') {
    return input
      .split(/[\n,;]+/g)
      .map((item) => normalizeEmail(item))
      .filter((item) => item.length > 0)
  }

  return []
}

export async function GET(req: NextRequest) {
  const { user, workspace } = await getRequestWorkspace()
  if (!user || !workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const status = req.nextUrl.searchParams.get('status') ?? 'all'
  const format = req.nextUrl.searchParams.get('format') === 'csv' ? 'csv' : 'json'
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

  if (format === 'csv') {
    const rows = await db
      .select()
      .from(emailSuppressions)
      .where(and(...whereConditions))
      .orderBy(desc(emailSuppressions.updated_at), desc(emailSuppressions.created_at))

    const header = ['Email', 'Status', 'Motivo', 'Origem', 'Criado em', 'Atualizado em']
    const lines = rows.map((row) => [
      row.email,
      row.is_active ? 'Bloqueado' : 'Liberado',
      row.reason ?? '',
      row.source ?? '',
      row.created_at ? new Date(row.created_at).toLocaleString('pt-BR') : '',
      row.updated_at ? new Date(row.updated_at).toLocaleString('pt-BR') : '',
    ])

    const csv = [header, ...lines]
      .map((line) => line.map(sanitizeCsvCell).join(','))
      .join('\n')

    return new NextResponse(`\uFEFF${csv}`, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="email-suppressions-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
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
    emails?: string[] | string
    reason?: string | null
    source?: string | null
    is_active?: boolean
  }

  const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : 'manual'
  const source = typeof body.source === 'string' && body.source.trim() ? body.source.trim() : 'workspace_ui'
  const isActive = body.is_active !== false

  const hasSingleEmailField = typeof body.email === 'string'
  const singleEmail = typeof body.email === 'string' ? normalizeEmail(body.email) : ''
  const bulkEmails = parseEmailsInput(body.emails)

  if (hasSingleEmailField && !body.emails) {
    if (!singleEmail || !isValidEmail(singleEmail)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }

    const [row] = await db
      .insert(emailSuppressions)
      .values({
        workspace_id: workspace.id,
        email: singleEmail,
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

  const entries = Array.from(new Set(bulkEmails))
  if (entries.length === 0) {
    return NextResponse.json({ error: 'emails is required for bulk import' }, { status: 400 })
  }
  if (entries.length > 20_000) {
    return NextResponse.json({ error: 'Too many emails in one request (max 20000)' }, { status: 413 })
  }

  const validEmails = entries.filter((email) => isValidEmail(email))
  const invalid = entries.length - validEmails.length
  const chunkSize = 500
  let imported = 0

  for (let index = 0; index < validEmails.length; index += chunkSize) {
    const chunk = validEmails.slice(index, index + chunkSize)
    const now = new Date()

    await db
      .insert(emailSuppressions)
      .values(chunk.map((email) => ({
        workspace_id: workspace.id,
        email,
        reason,
        source,
        is_active: isActive,
        created_at: now,
        updated_at: now,
      })))
      .onConflictDoUpdate({
        target: [emailSuppressions.workspace_id, emailSuppressions.email],
        set: {
          reason,
          source,
          is_active: isActive,
          updated_at: now,
        },
      })

    imported += chunk.length
  }

  return NextResponse.json({
    ok: true,
    imported,
    invalid,
    totalInput: entries.length,
  })
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
