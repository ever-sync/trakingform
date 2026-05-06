import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

function isProduction() {
  return process.env.NODE_ENV === 'production'
}

export async function GET() {
  try {
    await db.execute(sql`SELECT 1 as ok`)
    return NextResponse.json({ status: 'ok', db: 'connected' })
  } catch (err: unknown) {
    console.error('[health] DB error:', err instanceof Error ? err.stack : err)
    const message = isProduction()
      ? 'Database unavailable'
      : err instanceof Error
        ? err.message
        : 'Unknown error'
    return NextResponse.json({ status: 'error', message }, { status: 503 })
  }
}
