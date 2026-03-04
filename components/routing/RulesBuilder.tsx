'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ChevronDown, ChevronUp, Loader2, Play, Plus, Save, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

interface RoutingConditionItem {
  field: string
  operator: 'equals' | 'contains' | 'not_equals' | 'greater_than' | 'less_than' | 'in'
  value: string
}

interface RuleAssignment {
  mode: 'none' | 'round_robin' | 'fixed_user'
  user_id?: string
}

interface RuleItem {
  id: string
  name: string
  is_active: boolean
  priority: number
  conditions: RoutingConditionItem[]
  assignment: RuleAssignment
}

interface MemberItem {
  user_id: string
  email: string
}

interface TestConditionResult {
  field: string
  operator: string
  expected: unknown
  actual: unknown
  matched: boolean
}

interface TestRuleResult {
  ruleId: string
  ruleName: string
  priority: number
  matched: boolean
  assignmentMode: string
  assignmentUserId: string | null
  conditions: TestConditionResult[]
}

interface RoutingTestResult {
  assigned: boolean
  dryRun: boolean
  leadId: string
  ruleId: string | null
  ruleName: string | null
  assignedTo: string | null
  evaluation: TestRuleResult[]
}

const FIELD_OPTIONS = [
  { value: 'utm_source', label: 'UTM Source' },
  { value: 'utm_campaign', label: 'UTM Campaign' },
  { value: 'score', label: 'Score' },
  { value: 'region', label: 'Regiao' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Telefone' },
] as const

const OPERATOR_OPTIONS: Array<{ value: RoutingConditionItem['operator']; label: string }> = [
  { value: 'equals', label: 'Igual' },
  { value: 'contains', label: 'Contem' },
  { value: 'not_equals', label: 'Diferente' },
  { value: 'greater_than', label: 'Maior que' },
  { value: 'less_than', label: 'Menor que' },
  { value: 'in', label: 'Esta em lista' },
]

function nextTmpId() {
  return `tmp_${Date.now()}_${Math.floor(Math.random() * 10000)}`
}

function normalizeRule(raw: Partial<RuleItem>): RuleItem {
  const assignmentRaw: RuleAssignment = raw.assignment && typeof raw.assignment === 'object' && !Array.isArray(raw.assignment)
    ? (raw.assignment as RuleAssignment)
    : { mode: 'round_robin' }

  const mode = assignmentRaw.mode === 'fixed_user' || assignmentRaw.mode === 'none' || assignmentRaw.mode === 'round_robin'
    ? assignmentRaw.mode
    : 'round_robin'

  return {
    id: String(raw.id ?? nextTmpId()),
    name: String(raw.name ?? 'Nova regra'),
    is_active: raw.is_active !== false,
    priority: Number.isFinite(raw.priority) ? Number(raw.priority) : 0,
    conditions: Array.isArray(raw.conditions)
      ? raw.conditions.map((item) => {
          const c = item as Partial<RoutingConditionItem>
          return {
            field: String(c.field ?? 'utm_source'),
            operator: (c.operator ?? 'equals') as RoutingConditionItem['operator'],
            value: String(c.value ?? ''),
          }
        })
      : [],
    assignment: {
      mode,
      user_id: assignmentRaw.user_id,
    },
  }
}

export function RulesBuilder() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [rules, setRules] = useState<RuleItem[]>([])
  const [members, setMembers] = useState<MemberItem[]>([])
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null)

  const [testingLeadId, setTestingLeadId] = useState('')
  const [testDryRun, setTestDryRun] = useState(true)
  const [testing, setTesting] = useState(false)
  const [lastTestResult, setLastTestResult] = useState<RoutingTestResult | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/routing/rules').then((res) => res.json()),
      fetch('/api/workspace/members').then((res) => res.json()),
    ])
      .then(([rulesData, membersData]) => {
        const rawRules = Array.isArray(rulesData.rules) ? rulesData.rules : []
        const parsedRules = rawRules.map((item: Partial<RuleItem>) => normalizeRule(item))
        setRules(parsedRules)
        if (parsedRules.length > 0) {
          setExpandedRuleId(parsedRules[0].id)
        }

        const rawMembers = Array.isArray(membersData.members) ? membersData.members : []
        setMembers(
          rawMembers
            .map((row: { user_id?: string; email?: string }) => ({
              user_id: String(row.user_id ?? ''),
              email: String(row.email ?? ''),
            }))
            .filter((m: MemberItem) => m.user_id && m.email)
        )
      })
      .catch(() => toast.error('Erro ao carregar regras.'))
      .finally(() => setLoading(false))
  }, [])

  const sortedRules = useMemo(() => [...rules].sort((a, b) => a.priority - b.priority), [rules])

  function addRule() {
    const id = nextTmpId()
    setRules((prev) => [
      ...prev,
      {
        id,
        name: 'Nova regra',
        is_active: true,
        priority: prev.length,
        conditions: [],
        assignment: { mode: 'round_robin' },
      },
    ])
    setExpandedRuleId(id)
  }

  function addCondition(ruleId: string) {
    setRules((prev) =>
      prev.map((item) =>
        item.id === ruleId
          ? {
              ...item,
              conditions: [...item.conditions, { field: 'utm_source', operator: 'equals', value: '' }],
            }
          : item
      )
    )
  }

  function removeCondition(ruleId: string, conditionIndex: number) {
    setRules((prev) =>
      prev.map((item) =>
        item.id === ruleId
          ? {
              ...item,
              conditions: item.conditions.filter((_, index) => index !== conditionIndex),
            }
          : item
      )
    )
  }

  function updateCondition(ruleId: string, conditionIndex: number, patch: Partial<RoutingConditionItem>) {
    setRules((prev) =>
      prev.map((item) => {
        if (item.id !== ruleId) return item
        return {
          ...item,
          conditions: item.conditions.map((condition, index) => (index === conditionIndex ? { ...condition, ...patch } : condition)),
        }
      })
    )
  }

  async function saveRule(rule: RuleItem) {
    if (rule.assignment.mode === 'fixed_user' && !rule.assignment.user_id) {
      toast.error('Selecione um usuario para modo fixo.')
      return
    }

    setSaving(rule.id)
    try {
      const res = await fetch('/api/routing/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(rule.id.startsWith('tmp_') ? {} : { id: rule.id }),
          name: rule.name,
          is_active: rule.is_active,
          priority: rule.priority,
          conditions: rule.conditions,
          assignment: rule.assignment,
        }),
      })

      if (!res.ok) throw new Error('Falha ao salvar')
      const saved = await res.json()
      const normalized = normalizeRule(saved)
      setRules((prev) => prev.map((item) => (item.id === rule.id ? normalized : item)))
      setExpandedRuleId(normalized.id)
      toast.success('Regra salva.')
    } catch {
      toast.error('Nao foi possivel salvar a regra.')
    } finally {
      setSaving(null)
    }
  }

  async function removeRule(rule: RuleItem) {
    if (rule.id.startsWith('tmp_')) {
      setRules((prev) => prev.filter((item) => item.id !== rule.id))
      if (expandedRuleId === rule.id) setExpandedRuleId(null)
      return
    }

    setSaving(rule.id)
    try {
      const res = await fetch('/api/routing/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rule.id, delete: true }),
      })
      if (!res.ok) throw new Error('Falha ao apagar')
      setRules((prev) => prev.filter((item) => item.id !== rule.id))
      if (expandedRuleId === rule.id) setExpandedRuleId(null)
      toast.success('Regra apagada.')
    } catch {
      toast.error('Nao foi possivel apagar a regra.')
    } finally {
      setSaving(null)
    }
  }

  async function testAssignment() {
    if (!testingLeadId.trim()) {
      toast.error('Informe um leadId para testar.')
      return
    }

    setTesting(true)
    try {
      const res = await fetch('/api/routing/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: testingLeadId.trim(), dryRun: testDryRun }),
      })
      const payload = (await res.json()) as RoutingTestResult & { error?: string }
      if (!res.ok) throw new Error(payload.error || 'Falha no teste')

      setLastTestResult(payload)
      if (payload.ruleName) {
        const mode = payload.dryRun ? 'simulado' : 'aplicado'
        toast.success(`Regra ${mode}: ${payload.ruleName}`)
      } else {
        toast.success('Nenhuma regra bateu para este lead.')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha no teste')
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Teste de atribuicao</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 md:flex-row">
            <Input
              value={testingLeadId}
              onChange={(event) => setTestingLeadId(event.target.value)}
              placeholder="leadId para testar routing"
            />
            <Button onClick={() => void testAssignment()} disabled={testing}>
              {testing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Play className="mr-1.5 h-4 w-4" />}
              Testar
            </Button>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Switch checked={testDryRun} onCheckedChange={setTestDryRun} />
            Modo simulacao (nao altera owner nem grava log)
          </label>

          {lastTestResult ? (
            <div className="rounded-md border p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant={lastTestResult.ruleName ? 'default' : 'secondary'}>
                  {lastTestResult.ruleName ? 'Com match' : 'Sem match'}
                </Badge>
                {lastTestResult.ruleName ? <Badge variant="outline">Regra: {lastTestResult.ruleName}</Badge> : null}
                <Badge variant="outline">Dry run: {lastTestResult.dryRun ? 'sim' : 'nao'}</Badge>
              </div>

              <div className="space-y-2">
                {(lastTestResult.evaluation ?? []).map((item) => (
                  <div key={item.ruleId} className="rounded border p-2 text-xs">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="font-medium">{item.ruleName}</span>
                      <Badge variant={item.matched ? 'default' : 'secondary'}>{item.matched ? 'match' : 'no match'}</Badge>
                      <Badge variant="outline">prio {item.priority}</Badge>
                      <Badge variant="outline">{item.assignmentMode}</Badge>
                    </div>
                    {item.conditions.length === 0 ? (
                      <p className="text-muted-foreground">Sem condicoes.</p>
                    ) : (
                      <div className="space-y-1">
                        {item.conditions.map((condition, index) => (
                          <p key={`${item.ruleId}_${index}`} className="text-muted-foreground">
                            {condition.field} {condition.operator} {String(condition.expected ?? '')} {'->'} atual: {String(condition.actual ?? '')} ({condition.matched ? 'ok' : 'falhou'})
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={addRule}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nova regra
        </Button>
      </div>

      {sortedRules.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhuma regra criada ainda.</CardContent>
        </Card>
      ) : (
        sortedRules.map((rule) => (
          <Card key={rule.id}>
            <CardHeader className="gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <CardTitle className="truncate text-base">{rule.name}</CardTitle>
                  <Badge variant={rule.is_active ? 'default' : 'secondary'}>{rule.is_active ? 'Ativa' : 'Inativa'}</Badge>
                  <Badge variant="outline">Prioridade {rule.priority}</Badge>
                  <Badge variant="outline">{rule.conditions.length} condicao(oes)</Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setExpandedRuleId((prev) => (prev === rule.id ? null : rule.id))}>
                  {expandedRuleId === rule.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </CardHeader>

            {expandedRuleId === rule.id ? (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Nome</Label>
                    <Input
                      value={rule.name}
                      onChange={(event) =>
                        setRules((prev) => prev.map((item) => (item.id === rule.id ? { ...item, name: event.target.value } : item)))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Prioridade</Label>
                    <Input
                      type="number"
                      value={rule.priority}
                      onChange={(event) =>
                        setRules((prev) =>
                          prev.map((item) => (item.id === rule.id ? { ...item, priority: Number(event.target.value) || 0 } : item))
                        )
                      }
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded border p-3">
                  <div>
                    <p className="text-sm font-medium">Regra ativa</p>
                    <p className="text-xs text-muted-foreground">Regras inativas sao ignoradas pelo engine.</p>
                  </div>
                  <Switch
                    checked={!!rule.is_active}
                    onCheckedChange={(checked) =>
                      setRules((prev) => prev.map((item) => (item.id === rule.id ? { ...item, is_active: checked } : item)))
                    }
                  />
                </div>

                <div className="space-y-2 rounded border p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Condicoes</p>
                    <Button size="sm" variant="outline" onClick={() => addCondition(rule.id)}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Condicao
                    </Button>
                  </div>

                  {rule.conditions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sem condicoes: aplica para todos os leads.</p>
                  ) : (
                    <div className="space-y-2">
                      {rule.conditions.map((condition, conditionIndex) => (
                        <div key={`${rule.id}_${conditionIndex}`} className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
                          <select
                            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                            value={condition.field}
                            onChange={(event) => updateCondition(rule.id, conditionIndex, { field: event.target.value })}
                          >
                            {FIELD_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>

                          <select
                            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                            value={condition.operator}
                            onChange={(event) =>
                              updateCondition(rule.id, conditionIndex, {
                                operator: event.target.value as RoutingConditionItem['operator'],
                              })
                            }
                          >
                            {OPERATOR_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>

                          <Input
                            value={condition.value}
                            onChange={(event) => updateCondition(rule.id, conditionIndex, { value: event.target.value })}
                            placeholder="valor"
                          />

                          <Button variant="outline" size="icon" onClick={() => removeCondition(rule.id, conditionIndex)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2 rounded border p-3">
                  <p className="text-sm font-medium">Atribuicao</p>
                  <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                    <select
                      className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                      value={rule.assignment.mode}
                      onChange={(event) =>
                        setRules((prev) =>
                          prev.map((item) =>
                            item.id === rule.id
                              ? {
                                  ...item,
                                  assignment: {
                                    ...item.assignment,
                                    mode: event.target.value as RuleAssignment['mode'],
                                    ...(event.target.value !== 'fixed_user' ? { user_id: undefined } : {}),
                                  },
                                }
                              : item
                          )
                        )
                      }
                    >
                      <option value="round_robin">Round Robin</option>
                      <option value="fixed_user">Usuario fixo</option>
                      <option value="none">Sem atribuicao</option>
                    </select>

                    {rule.assignment.mode === 'fixed_user' ? (
                      <select
                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                        value={rule.assignment.user_id ?? ''}
                        onChange={(event) =>
                          setRules((prev) =>
                            prev.map((item) =>
                              item.id === rule.id ? { ...item, assignment: { ...item.assignment, user_id: event.target.value || undefined } } : item
                            )
                          )
                        }
                      >
                        <option value="">Selecione o usuario</option>
                        {members.map((member) => (
                          <option key={member.user_id} value={member.user_id}>
                            {member.email}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                  {rule.assignment.mode === 'round_robin' ? (
                    <p className="text-xs text-muted-foreground">Distribui automaticamente entre membros do workspace.</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void saveRule(rule)} disabled={saving === rule.id}>
                    {saving === rule.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                    Salvar
                  </Button>
                  <Button variant="outline" onClick={() => void removeRule(rule)} disabled={saving === rule.id}>
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Apagar
                  </Button>
                </div>
              </CardContent>
            ) : null}
          </Card>
        ))
      )}
    </div>
  )
}
