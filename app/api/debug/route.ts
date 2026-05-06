import { NextResponse } from 'next/server'

function isProduction() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
}

export async function GET() {
  if (isProduction()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const checks: Record<string, string> = {}

  checks.DATABASE_URL = process.env.DATABASE_URL ? 'set' : 'MISSING'
  checks.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'MISSING'
  checks.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'set' : 'MISSING'
  checks.UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL ? 'set' : 'not set (optional)'
  checks.UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ? 'set' : 'not set (optional)'

  try {
    const { db } = await import('@/lib/db')
    await db.execute('SELECT 1 as ok' as never)
    checks.db_connection = 'OK'
  } catch (err: unknown) {
    checks.db_connection = 'FAILED: ' + (err instanceof Error ? err.message : String(err))
  }

  try {
    const { db } = await import('@/lib/db')
    const { forms } = await import('@/lib/db/schema')
    const { eq } = await import('drizzle-orm')
    const form = await db.query.forms.findFirst({
      where: eq(forms.id, 'd2f88e5c-4db6-4443-b260-8fb074e7b9b3'),
    })
    checks.form_query = form ? `Found: ${form.name}` : 'NOT FOUND'
  } catch (err: unknown) {
    checks.form_query = 'FAILED: ' + (err instanceof Error ? err.message : String(err))
  }

  const importChecks = [
    ['import_form_validator', '@/lib/services/form-validator'],
    ['import_duplicate_detector', '@/lib/services/duplicate-detector'],
    ['import_ip_enrichment', '@/lib/services/ip-enrichment'],
    ['import_webhook_dispatcher', '@/lib/services/webhook-dispatcher'],
    ['import_whatsapp_notifier', '@/lib/services/whatsapp-notifier'],
    ['import_ai_lead_score', '@/lib/services/ai-lead-score'],
    ['import_routing_engine', '@/lib/services/routing/engine'],
    ['import_lead_events', '@/lib/services/lead-events'],
    ['import_email_dispatcher', '@/lib/services/email/dispatcher'],
    ['import_ab_test', '@/lib/services/ab-test'],
  ] as const

  for (const [key, mod] of importChecks) {
    try {
      await import(mod)
      checks[key] = 'OK'
    } catch (err: unknown) {
      checks[key] = 'FAILED: ' + (err instanceof Error ? err.message : String(err))
    }
  }

  return NextResponse.json(checks, { status: 200 })
}
