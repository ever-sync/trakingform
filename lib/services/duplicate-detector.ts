import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import { eq, and, or } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

interface DuplicateCheckInput {
  workspaceId: string
  email?: string
  phone?: string
  fingerprint?: string | null
}

export async function detectDuplicate(input: DuplicateCheckInput): Promise<string | null> {
  const conditions = []

  if (input.email) {
    conditions.push(sql`${leads.data}->>'email' = ${input.email}`)
  }
  if (input.phone) {
    conditions.push(sql`${leads.data}->>'phone' = ${input.phone}`)
  }
  if (input.fingerprint) {
    conditions.push(eq(leads.fingerprint, input.fingerprint))
  }

  if (conditions.length === 0) return null

  const existing = await db.query.leads.findFirst({
    where: and(
      eq(leads.workspace_id, input.workspaceId),
      or(...conditions)
    ),
    columns: { id: true },
  })

  return existing?.id ?? null
}
