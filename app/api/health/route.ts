import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

export async function GET() {
  try {
    const result = await db.execute(sql`SELECT 1 as ok`)
    return NextResponse.json({ status: 'ok', db: 'connected', result })
  } catch (err: unknown) {
    console.error('[health] DB error:', err instanceof Error ? err.stack : err)
    return NextResponse.json(
      { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
