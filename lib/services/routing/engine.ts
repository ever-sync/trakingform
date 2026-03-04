import { db } from '@/lib/db'
import { leadAssignmentLogs, leadRoutingRulesV2, leads, workspaceMembers } from '@/lib/db/schema'
import { and, asc, eq } from 'drizzle-orm'

interface RoutingContext {
  workspaceId: string
  leadId: string
  data: Record<string, unknown>
  score: number
  utmSource?: string | null
  utmCampaign?: string | null
  region?: string | null
}

function evaluateCondition(condition: Record<string, unknown>, ctx: RoutingContext): boolean {
  const field = String(condition.field ?? '')
  const operator = String(condition.operator ?? 'equals')
  const value = condition.value

  let source: unknown = null
  if (field === 'utm_source') source = ctx.utmSource
  else if (field === 'utm_campaign') source = ctx.utmCampaign
  else if (field === 'score') source = ctx.score
  else if (field === 'region') source = ctx.region
  else source = ctx.data[field]

  const sourceStr = String(source ?? '').toLowerCase()
  const targetStr = String(value ?? '').toLowerCase()

  if (operator === 'equals') return sourceStr === targetStr
  if (operator === 'contains') return sourceStr.includes(targetStr)
  if (operator === 'not_equals') return sourceStr !== targetStr
  if (operator === 'greater_than') return Number(source ?? 0) > Number(value ?? 0)
  if (operator === 'less_than') return Number(source ?? 0) < Number(value ?? 0)
  if (operator === 'in') {
    const arr = Array.isArray(value) ? value : String(value ?? '').split(',')
    return arr.map((item) => String(item).trim().toLowerCase()).includes(sourceStr)
  }

  return true
}

function matchRule(conditions: unknown, ctx: RoutingContext): boolean {
  if (!Array.isArray(conditions) || conditions.length === 0) return true
  return conditions.every((condition) => {
    if (!condition || typeof condition !== 'object' || Array.isArray(condition)) return false
    return evaluateCondition(condition as Record<string, unknown>, ctx)
  })
}

async function getRoundRobinOwner(workspaceId: string): Promise<string | null> {
  const members = await db
    .select({ user_id: workspaceMembers.user_id })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspace_id, workspaceId))
    .orderBy(asc(workspaceMembers.accepted_at))

  if (members.length === 0) return null
  const randomIndex = Math.floor(Math.random() * members.length)
  return members[randomIndex]?.user_id ?? null
}

export async function assignLeadByRoutingRules(ctx: RoutingContext) {
  const rules = await db
    .select()
    .from(leadRoutingRulesV2)
    .where(and(
      eq(leadRoutingRulesV2.workspace_id, ctx.workspaceId),
      eq(leadRoutingRulesV2.is_active, true)
    ))
    .orderBy(asc(leadRoutingRulesV2.priority), asc(leadRoutingRulesV2.created_at))

  for (const rule of rules) {
    if (!matchRule(rule.conditions, ctx)) continue

    const assignment = (rule.assignment && typeof rule.assignment === 'object' && !Array.isArray(rule.assignment))
      ? rule.assignment as Record<string, unknown>
      : {}

    let assignedTo: string | null = null
    const mode = String(assignment.mode ?? 'none')

    if (mode === 'fixed_user') {
      assignedTo = typeof assignment.user_id === 'string' ? assignment.user_id : null
    } else if (mode === 'round_robin') {
      assignedTo = await getRoundRobinOwner(ctx.workspaceId)
    }

    await db
      .update(leads)
      .set({ owner_id: assignedTo, updated_at: new Date() })
      .where(eq(leads.id, ctx.leadId))

    await db.insert(leadAssignmentLogs).values({
      workspace_id: ctx.workspaceId,
      lead_id: ctx.leadId,
      rule_id: rule.id,
      assigned_to: assignedTo,
      reason: `Matched routing rule: ${rule.name}`,
      metadata: {
        mode,
        utm_source: ctx.utmSource ?? null,
        score: ctx.score,
      },
    })

    return {
      assigned: true,
      leadId: ctx.leadId,
      ruleId: rule.id,
      ruleName: rule.name,
      assignedTo,
    }
  }

  return {
    assigned: false,
    leadId: ctx.leadId,
    ruleId: null,
    ruleName: null,
    assignedTo: null,
  }
}

