import { NextResponse } from 'next/server'

export async function GET() {
  const checks: Record<string, string> = {}

  // Check env vars
  checks.DATABASE_URL = process.env.DATABASE_URL ? 'set (' + process.env.DATABASE_URL.substring(0, 20) + '...)' : 'MISSING'
  checks.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'MISSING'
  checks.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'set' : 'MISSING'
  checks.UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL ? 'set' : 'not set (optional)'
  checks.UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ? 'set' : 'not set (optional)'

  // Test DB connection
  try {
    const { db } = await import('@/lib/db')
    const result = await db.execute('SELECT 1 as ok' as never)
    checks.db_connection = 'OK'
  } catch (err: unknown) {
    checks.db_connection = 'FAILED: ' + (err instanceof Error ? err.message : String(err))
  }

  // Test form query
  try {
    const { db } = await import('@/lib/db')
    const { forms } = await import('@/lib/db/schema')
    const { eq } = await import('drizzle-orm')
    const form = await db.query.forms.findFirst({
      where: eq(forms.id, 'd2f88e5c-4db6-4443-b260-8fb074e7b9b3'),
    })
    checks.form_query = form ? 'Found: ' + form.name : 'NOT FOUND'
  } catch (err: unknown) {
    checks.form_query = 'FAILED: ' + (err instanceof Error ? err.message : String(err))
  }

  // Test imports used by submit route
  try {
    await import('@/lib/services/form-validator')
    checks.import_form_validator = 'OK'
  } catch (err: unknown) {
    checks.import_form_validator = 'FAILED: ' + (err instanceof Error ? err.message : String(err))
  }

  try {
    await import('@/lib/services/duplicate-detector')
    checks.import_duplicate_detector = 'OK'
  } catch (err: unknown) {
    checks.import_duplicate_detector = 'FAILED: ' + (err instanceof Error ? err.message : String(err))
  }

  try {
    await import('@/lib/services/ip-enrichment')
    checks.import_ip_enrichment = 'OK'
  } catch (err: unknown) {
    checks.import_ip_enrichment = 'FAILED: ' + (err instanceof Error ? err.message : String(err))
  }

  try {
    await import('@/lib/services/webhook-dispatcher')
    checks.import_webhook_dispatcher = 'OK'
  } catch (err: unknown) {
    checks.import_webhook_dispatcher = 'FAILED: ' + (err instanceof Error ? err.message : String(err))
  }

  try {
    await import('@/lib/services/whatsapp-notifier')
    checks.import_whatsapp_notifier = 'OK'
  } catch (err: unknown) {
    checks.import_whatsapp_notifier = 'FAILED: ' + (err instanceof Error ? err.message : String(err))
  }

  try {
    await import('@/lib/services/ai-lead-score')
    checks.import_ai_lead_score = 'OK'
  } catch (err: unknown) {
    checks.import_ai_lead_score = 'FAILED: ' + (err instanceof Error ? err.message : String(err))
  }

  try {
    await import('@/lib/services/routing/engine')
    checks.import_routing_engine = 'OK'
  } catch (err: unknown) {
    checks.import_routing_engine = 'FAILED: ' + (err instanceof Error ? err.message : String(err))
  }

  try {
    await import('@/lib/services/lead-events')
    checks.import_lead_events = 'OK'
  } catch (err: unknown) {
    checks.import_lead_events = 'FAILED: ' + (err instanceof Error ? err.message : String(err))
  }

  try {
    await import('@/lib/services/email/dispatcher')
    checks.import_email_dispatcher = 'OK'
  } catch (err: unknown) {
    checks.import_email_dispatcher = 'FAILED: ' + (err instanceof Error ? err.message : String(err))
  }

  try {
    await import('@/lib/services/ab-test')
    checks.import_ab_test = 'OK'
  } catch (err: unknown) {
    checks.import_ab_test = 'FAILED: ' + (err instanceof Error ? err.message : String(err))
  }

  return NextResponse.json(checks, { status: 200 })
}
