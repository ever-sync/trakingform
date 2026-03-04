import { NextRequest, NextResponse } from 'next/server'
import { and, asc, count, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { forms, leads } from '@/lib/db/schema'
import { getOrCreateWorkspace } from '@/lib/db/queries/workspace'

const DATE_TZ = 'America/Sao_Paulo'
const STATUS_VALUES = ['all', 'new', 'contacted', 'qualified', 'converted', 'lost'] as const
const DUPLICATE_VALUES = ['all', 'yes', 'no'] as const
const SORT_BY_VALUES = ['created_at', 'score', 'name'] as const
const SORT_DIR_VALUES = ['asc', 'desc'] as const
const PAGE_SIZE_VALUES = [10, 25, 50, 100] as const

const nameExpr = sql<string>`coalesce(
  nullif(trim(${leads.data}->>'name'), ''),
  nullif(trim(${leads.data}->>'nome'), ''),
  nullif(trim(${leads.data}->>'full_name'), ''),
  '-'
)`

const emailExpr = sql<string>`coalesce(nullif(trim(${leads.data}->>'email'), ''), '-')`

const phoneExpr = sql<string>`coalesce(
  nullif(trim(${leads.data}->>'phone'), ''),
  nullif(trim(${leads.data}->>'telefone'), ''),
  '-'
)`

const utmSourceExpr = sql<string>`coalesce(
  nullif(trim(${leads.utm_source}), ''),
  nullif(trim(${leads.data}->>'utm_source'), ''),
  nullif(trim(${leads.data}->>'_utm_source'), ''),
  ''
)`

function parseIntOr(value: string | null, fallback: number) {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function sanitizeCsvCell(value: unknown) {
  const raw = String(value ?? '')
  return `"${raw.replace(/"/g, '""')}"`
}

function getDateLabel(value: Date | null) {
  if (!value) return '-'
  return value.toLocaleString('pt-BR', {
    timeZone: DATE_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function clampScore(value: number) {
  if (value < 0) return 0
  if (value > 100) return 100
  return value
}

function isStatus(value: string): value is (typeof STATUS_VALUES)[number] {
  return (STATUS_VALUES as readonly string[]).includes(value)
}

function isDuplicate(value: string): value is (typeof DUPLICATE_VALUES)[number] {
  return (DUPLICATE_VALUES as readonly string[]).includes(value)
}

function isSortBy(value: string): value is (typeof SORT_BY_VALUES)[number] {
  return (SORT_BY_VALUES as readonly string[]).includes(value)
}

function isSortDir(value: string): value is (typeof SORT_DIR_VALUES)[number] {
  return (SORT_DIR_VALUES as readonly string[]).includes(value)
}

interface LeadFilters {
  q: string
  status: (typeof STATUS_VALUES)[number]
  dateFrom: string
  dateTo: string
  formId: string
  utmSource: string
  scoreMin: number
  scoreMax: number
  duplicate: (typeof DUPLICATE_VALUES)[number]
  sortBy: (typeof SORT_BY_VALUES)[number]
  sortDir: (typeof SORT_DIR_VALUES)[number]
  page: number
  pageSize: (typeof PAGE_SIZE_VALUES)[number]
  format: 'json' | 'csv'
}

function parseFilters(req: NextRequest): LeadFilters {
  const params = req.nextUrl.searchParams

  const statusParam = params.get('status') ?? 'all'
  const duplicateParam = params.get('duplicate') ?? 'all'
  const sortByParam = params.get('sortBy') ?? 'created_at'
  const sortDirParam = params.get('sortDir') ?? 'desc'

  const page = Math.max(1, parseIntOr(params.get('page'), 1))

  const requestedPageSize = parseIntOr(params.get('pageSize'), 25)
  const pageSize = PAGE_SIZE_VALUES.includes(requestedPageSize as (typeof PAGE_SIZE_VALUES)[number])
    ? (requestedPageSize as (typeof PAGE_SIZE_VALUES)[number])
    : 25

  const scoreMin = clampScore(parseIntOr(params.get('scoreMin'), 0))
  const scoreMax = clampScore(parseIntOr(params.get('scoreMax'), 100))

  const formatParam = params.get('format')

  return {
    q: (params.get('q') ?? '').trim(),
    status: isStatus(statusParam) ? statusParam : 'all',
    dateFrom: (params.get('dateFrom') ?? '').trim(),
    dateTo: (params.get('dateTo') ?? '').trim(),
    formId: (params.get('formId') ?? '').trim(),
    utmSource: (params.get('utmSource') ?? '').trim(),
    scoreMin: Math.min(scoreMin, scoreMax),
    scoreMax: Math.max(scoreMin, scoreMax),
    duplicate: isDuplicate(duplicateParam) ? duplicateParam : 'all',
    sortBy: isSortBy(sortByParam) ? sortByParam : 'created_at',
    sortDir: isSortDir(sortDirParam) ? sortDirParam : 'desc',
    page,
    pageSize,
    format: formatParam === 'csv' ? 'csv' : 'json',
  }
}

function buildWhere(workspaceId: string, filters: LeadFilters): SQL[] {
  const conditions: SQL[] = [eq(leads.workspace_id, workspaceId)]

  if (filters.status !== 'all') {
    conditions.push(eq(leads.status, filters.status))
  }

  if (filters.formId) {
    conditions.push(eq(leads.form_id, filters.formId))
  }

  if (filters.utmSource) {
    conditions.push(sql`${utmSourceExpr} = ${filters.utmSource}`)
  }

  if (filters.duplicate === 'yes') {
    conditions.push(eq(leads.is_duplicate, true))
  }
  if (filters.duplicate === 'no') {
    conditions.push(eq(leads.is_duplicate, false))
  }

  if (filters.scoreMin > 0) {
    conditions.push(gte(leads.score, filters.scoreMin))
  }
  if (filters.scoreMax < 100) {
    conditions.push(lte(leads.score, filters.scoreMax))
  }

  if (filters.dateFrom) {
    conditions.push(sql`(${leads.created_at} at time zone ${DATE_TZ})::date >= ${filters.dateFrom}`)
  }
  if (filters.dateTo) {
    conditions.push(sql`(${leads.created_at} at time zone ${DATE_TZ})::date <= ${filters.dateTo}`)
  }

  if (filters.q) {
    const pattern = `%${filters.q.toLowerCase()}%`
    conditions.push(sql`(
      lower(${nameExpr}) like ${pattern}
      or lower(${emailExpr}) like ${pattern}
      or lower(${phoneExpr}) like ${pattern}
    )`)
  }

  return conditions
}

type LeadRow = {
  id: string
  status: string | null
  score: number | null
  is_duplicate: boolean | null
  form_name: string | null
  created_at: Date | null
  name: string
  email: string
  phone: string
  utm_source: string
}

async function fetchRows(conditions: SQL[], filters: LeadFilters, paginated: boolean) {
  const baseQuery = db
    .select({
      id: leads.id,
      status: leads.status,
      score: leads.score,
      is_duplicate: leads.is_duplicate,
      form_name: forms.name,
      created_at: leads.created_at,
      name: nameExpr,
      email: emailExpr,
      phone: phoneExpr,
      utm_source: utmSourceExpr,
    })
    .from(leads)
    .leftJoin(forms, eq(leads.form_id, forms.id))
    .where(and(...conditions))

  const orderedQuery = (() => {
    if (filters.sortBy === 'score') {
      return filters.sortDir === 'asc'
        ? baseQuery.orderBy(asc(leads.score), desc(leads.created_at))
        : baseQuery.orderBy(desc(leads.score), desc(leads.created_at))
    }

    if (filters.sortBy === 'name') {
      return filters.sortDir === 'asc'
        ? baseQuery.orderBy(sql`lower(${nameExpr}) asc`, desc(leads.created_at))
        : baseQuery.orderBy(sql`lower(${nameExpr}) desc`, desc(leads.created_at))
    }

    return filters.sortDir === 'asc'
      ? baseQuery.orderBy(asc(leads.created_at))
      : baseQuery.orderBy(desc(leads.created_at))
  })()

  if (!paginated) {
    return orderedQuery
  }

  return orderedQuery.limit(filters.pageSize).offset((filters.page - 1) * filters.pageSize)
}

function normalizeRows(rows: LeadRow[]) {
  return rows.map((lead) => ({
    id: lead.id,
    name: lead.name || '-',
    email: lead.email || '-',
    phone: lead.phone || '-',
    status: lead.status ?? 'new',
    score: lead.score ?? 0,
    is_duplicate: lead.is_duplicate ?? false,
    form_name: lead.form_name ?? 'Formulario removido',
    utm_source: lead.utm_source || null,
    created_at_iso: lead.created_at ? new Date(lead.created_at).toISOString() : null,
    created_at_label: getDateLabel(lead.created_at),
  }))
}

async function buildJsonResponse(workspaceId: string, filters: LeadFilters) {
  const conditions = buildWhere(workspaceId, filters)

  const [{ total }] = await db
    .select({ total: count() })
    .from(leads)
    .where(and(...conditions))

  const paginatedRows = await fetchRows(conditions, filters, true)
  const items = normalizeRows(paginatedRows as LeadRow[])

  const [{ avg_score, duplicate_rate }] = await db
    .select({
      avg_score: sql<number>`coalesce(avg(${leads.score}), 0)::float`,
      duplicate_rate: sql<number>`coalesce(avg(case when ${leads.is_duplicate} then 1 else 0 end), 0)::float`,
    })
    .from(leads)
    .where(and(...conditions))

  const [{ new_today }] = await db
    .select({
      new_today: count(),
    })
    .from(leads)
    .where(and(
      ...conditions,
      sql`(${leads.created_at} at time zone ${DATE_TZ})::date = (now() at time zone ${DATE_TZ})::date`
    ))

  const topSourceRows = await db
    .select({
      source: utmSourceExpr,
      total: sql<number>`count(*)::int`,
    })
    .from(leads)
    .where(and(...conditions))
    .groupBy(utmSourceExpr)
    .orderBy(desc(sql`count(*)`))
    .limit(5)

  const formOptions = await db
    .select({
      id: forms.id,
      name: forms.name,
    })
    .from(forms)
    .where(eq(forms.workspace_id, workspaceId))
    .orderBy(asc(forms.name))

  const utmOptionRows = await db
    .select({
      source: utmSourceExpr,
      total: sql<number>`count(*)::int`,
    })
    .from(leads)
    .where(and(
      eq(leads.workspace_id, workspaceId),
      sql`${utmSourceExpr} <> ''`
    ))
    .groupBy(utmSourceExpr)
    .orderBy(desc(sql`count(*)`))
    .limit(100)

  return {
    items,
    meta: {
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
    },
    summary: {
      totalLeads: total,
      newToday: new_today,
      avgScore: Number(avg_score ?? 0),
      duplicateRate: Number(duplicate_rate ?? 0),
    },
    topSources: topSourceRows
      .filter((row) => row.source && row.source.trim().length > 0)
      .map((row) => ({ source: row.source, count: row.total })),
    filterOptions: {
      forms: formOptions,
      utmSources: utmOptionRows
        .filter((row) => row.source && row.source.trim().length > 0)
        .map((row) => row.source),
    },
  }
}

async function buildCsvResponse(workspaceId: string, filters: LeadFilters) {
  const conditions = buildWhere(workspaceId, filters)
  const rows = await fetchRows(conditions, filters, false)
  const normalized = normalizeRows(rows as LeadRow[])

  const header = ['Nome', 'E-mail', 'Telefone', 'Status', 'Score', 'Formulario', 'UTM Source', 'Duplicado', 'Data']
  const lines = normalized.map((lead) => [
    lead.name,
    lead.email,
    lead.phone,
    lead.status,
    String(lead.score),
    lead.form_name,
    lead.utm_source ?? '',
    lead.is_duplicate ? 'Sim' : 'Nao',
    lead.created_at_label,
  ])

  const csv = [header, ...lines]
    .map((row) => row.map(sanitizeCsvCell).join(','))
    .join('\n')

  return new NextResponse(`\uFEFF${csv}`, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const workspace = await getOrCreateWorkspace(user.id, user.email ?? 'user@example.com')
  const filters = parseFilters(req)

  if (filters.format === 'csv') {
    return buildCsvResponse(workspace.id, filters)
  }

  const payload = await buildJsonResponse(workspace.id, filters)
  return NextResponse.json(payload)
}
