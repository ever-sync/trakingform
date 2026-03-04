import { db } from '@/lib/db'
import { leads, opsAlerts, slaPolicies } from '@/lib/db/schema'
import { and, desc, eq, isNull, lt } from 'drizzle-orm'

export async function runSlaMonitor(workspaceId?: string) {
  const whereConditions = [eq(slaPolicies.is_active, true)]
  if (workspaceId) {
    whereConditions.push(eq(slaPolicies.workspace_id, workspaceId))
  }

  const policies = await db
    .select()
    .from(slaPolicies)
    .where(and(...whereConditions))

  let generated = 0

  for (const policy of policies) {
    if (!policy.workspace_id) continue

    const threshold = new Date(Date.now() - (policy.first_response_minutes ?? 15) * 60_000)

    const overdueLeads = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(
        eq(leads.workspace_id, policy.workspace_id),
        eq(leads.status, 'new'),
        isNull(leads.first_response_at),
        lt(leads.created_at, threshold)
      ))
      .orderBy(desc(leads.created_at))
      .limit(100)

    for (const lead of overdueLeads) {
      await db.insert(opsAlerts).values({
        workspace_id: policy.workspace_id,
        source: 'sla_monitor',
        severity: 'warning',
        title: 'Lead sem primeiro contato no SLA',
        message: `Lead ${lead.id} sem resposta dentro de ${policy.first_response_minutes} minutos.`,
        payload: {
          lead_id: lead.id,
          policy_id: policy.id,
          first_response_minutes: policy.first_response_minutes,
        },
      })
      generated++
    }
  }

  return {
    generated,
    checkedPolicies: policies.length,
  }
}

