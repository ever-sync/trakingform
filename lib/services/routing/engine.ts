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

interface ConditionEvaluation {
  field: string
  operator: string
  expected: unknown
  actual: unknown
  matched: boolean
}

interface RuleEvaluation {
  ruleId: string
  ruleName: string
  priority: number
  matched: boolean
  assignmentMode: string
  assignmentUserId: string | null
  conditions: ConditionEvaluation[]
}

interface AssignOptions {
  dryRun?: boolean
}

function resolveConditionSource(field: string, ctx: RoutingContext): unknown {
  if (field === 'utm_source') return ctx.utmSource
  if (field === 'utm_campaign') return ctx.utmCampaign
  if (field === 'score') return ctx.score
  if (field === 'region') return ctx.region
  return ctx.data[field]
}

function evaluateCondition(condition: Record<string, unknown>, ctx: RoutingContext): ConditionEvaluation {
  const field = String(condition.field ?? '')
  const operator = String(condition.operator ?? 'equals')
  const expected = condition.value
  const actual = resolveConditionSource(field, ctx)

  const actualStr = String(actual ?? '').toLowerCase()
  const expectedStr = String(expected ?? '').toLowerCase()

  let matched = true
  if (operator === 'equals') matched = actualStr === expectedStr
  else if (operator === 'contains') matched = actualStr.includes(expectedStr)
  else if (operator === 'not_equals') matched = actualStr !== expectedStr
  else if (operator === 'greater_than') matched = Number(actual ?? 0) > Number(expected ?? 0)
  else if (operator === 'less_than') matched = Number(actual ?? 0) < Number(expected ?? 0)
  else if (operator === 'in') {
    const arr = Array.isArray(expected) ? expected : String(expected ?? '').split(',')
    matched = arr.map((item) => String(item).trim().toLowerCase()).includes(actualStr)
  }

  return {
    field,
    operator,
    expected,
    actual,
    matched,
  }
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

async function fetchActiveRules(workspaceId: string) {
  return db
    .select()
    .from(leadRoutingRulesV2)
    .where(and(eq(leadRoutingRulesV2.workspace_id, workspaceId), eq(leadRoutingRulesV2.is_active, true)))
    .orderBy(asc(leadRoutingRulesV2.priority), asc(leadRoutingRulesV2.created_at))
}

export function evaluateRulesForContext(
  rules: Awaited<ReturnType<typeof fetchActiveRules>>,
  ctx: RoutingContext
): RuleEvaluation[] {
  return rules.map((rule) => {
    const rawConditions = Array.isArray(rule.conditions) ? rule.conditions : []
    const conditions: ConditionEvaluation[] = rawConditions
      .filter((condition) => condition && typeof condition === 'object' && !Array.isArray(condition))
      .map((condition) => evaluateCondition(condition as Record<string, unknown>, ctx))

    const matched = conditions.length === 0 ? true : conditions.every((condition) => condition.matched)

    const assignment = rule.assignment && typeof rule.assignment === 'object' && !Array.isArray(rule.assignment)
      ? (rule.assignment as Record<string, unknown>)
      : {}

    const assignmentMode = String(assignment.mode ?? 'none')
    const assignmentUserId = typeof assignment.user_id === 'string' ? assignment.user_id : null

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      priority: rule.priority,
      matched,
      assignmentMode,
      assignmentUserId,
      conditions,
    }
  })
}

export async function assignLeadByRoutingRules(ctx: RoutingContext, options?: AssignOptions) {
  const dryRun = options?.dryRun === true
  const rules = await fetchActiveRules(ctx.workspaceId)
  const evaluation = evaluateRulesForContext(rules, ctx)
  const firstMatch = evaluation.find((item) => item.matched)

  if (!firstMatch) {
    return {
      assigned: false,
      dryRun,
      leadId: ctx.leadId,
      ruleId: null,
      ruleName: null,
      assignedTo: null,
      evaluation,
    }
  }

  let assignedTo: string | null = null
  if (firstMatch.assignmentMode === 'fixed_user') {
    assignedTo = firstMatch.assignmentUserId
  } else if (firstMatch.assignmentMode === 'round_robin') {
    assignedTo = await getRoundRobinOwner(ctx.workspaceId)
  }

  if (!dryRun) {
    await db
      .update(leads)
      .set({ owner_id: assignedTo, updated_at: new Date() })
      .where(eq(leads.id, ctx.leadId))

    await db.insert(leadAssignmentLogs).values({
      workspace_id: ctx.workspaceId,
      lead_id: ctx.leadId,
      rule_id: firstMatch.ruleId,
      assigned_to: assignedTo,
      reason: `Matched routing rule: ${firstMatch.ruleName}`,
      metadata: {
        mode: firstMatch.assignmentMode,
        utm_source: ctx.utmSource ?? null,
        score: ctx.score,
      },
    })
  }

  return {
    assigned: !dryRun,
    dryRun,
    leadId: ctx.leadId,
    ruleId: firstMatch.ruleId,
    ruleName: firstMatch.ruleName,
    assignedTo,
    evaluation,
  }
}
