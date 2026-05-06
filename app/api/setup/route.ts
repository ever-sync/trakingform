import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import postgres from 'postgres'

export const dynamic = 'force-dynamic'

function isProduction() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
}

async function loadMigrationSQL() {
  const migrationPath = path.join(process.cwd(), 'lib', 'db', 'migrations', '0000_safe_run.sql')
  return readFile(migrationPath, 'utf8')
}

function authorizeSetup(req: NextRequest): boolean {
  const secret = process.env.SETUP_SECRET
  if (!isProduction()) {
    if (!secret) return true
    return req.headers.get('x-setup-secret') === secret
  }
  if (!secret) return false
  return req.headers.get('x-setup-secret') === secret
}

export async function GET(req: NextRequest) {
  if (!authorizeSetup(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: isProduction() ? 404 : 401 })
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    return NextResponse.json({ ok: false, error: 'DATABASE_URL not configured' }, { status: 500 })
  }

  const client = postgres(databaseUrl, { prepare: false })

  try {
    const sql = await loadMigrationSQL()
    await client.unsafe(sql)
    return NextResponse.json({ ok: true, message: 'Tabelas criadas com sucesso!' })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  } finally {
    await client.end({ timeout: 5 }).catch(() => undefined)
  }
}
