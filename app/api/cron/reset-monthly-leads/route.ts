import { NextRequest, NextResponse } from 'next/server'
import { sql, count } from 'drizzle-orm'
import { db } from '@/lib/db'
import { workspaces } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

function authorizeCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization')
  if (auth === `Bearer ${secret}`) return true
  return req.headers.get('x-cron-secret') === secret
}

/** Reset mensal de `leads_used_this_month`. Proteja com CRON_SECRET. */
export async function POST(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const [{ total }] = await db.select({ total: count() }).from(workspaces)

  await db.execute(
    sql`UPDATE workspaces SET leads_used_this_month = 0, updated_at = now()`,
  )

  return NextResponse.json({
    ok: true,
    message: `Contagem mensal de leads zerada para ${total} workspace(s).`,
    workspaces: total,
  })
}

/** Vercel Cron envia GET por padrão. */
export async function GET(req: NextRequest) {
  return POST(req)
}
