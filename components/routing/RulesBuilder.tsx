'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Save, Trash2, Play, ChevronDown, ChevronUp } from 'lucide-react'
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

const FIELD_OPTIONS = [
  { value: 'utm_source', label: 'UTM Source' },
  { value: 'utm_campaign', label: 'UTM Campaign' },
  { value: 'score', label: 'Score' },
  { value: 'region', label: 'Região' },
  { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Telefone' },
] as const

const OPERATOR_OPTIONS: Array<{ value: RoutingConditionItem['operator']; label: string }> = [
  { value: 'equals', label: 'Igual' },
  { value: 'contains', label: 'Contém' },
  { value: 'not_equals', label: 'Diferente' },
  { value: 'greater_than', label: 'Maior que' },
  { value: 'less_than', label: 'Menor que' },
  { value: 'in', label: 'Está em lista' },
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
  const [testing, setTesting] = useState(false)

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
      toast.error('Selecione o usuário quando o modo for usuário fixo.')
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
      toast.error('Não foi possível salvar a regra.')
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
      toast.error('Não foi possível apagar a regra.')
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
        body: JSON.stringify({ leadId: testingLeadId.trim() }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || 'Falha no teste')

      if (payload.assigned) {
        toast.success(`Atribuído pela regra: ${payload.ruleName ?? 'N/A'}`)
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

  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Teste rápido de atribuição</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 md:flex-row">
          <Input
            value={testingLeadId}
            onChange={(event) => setTestingLeadId(event.target.value)}
            placeholder="leadId para testar routing"
          />
          <Button onClick={() => void testAssignment()} disabled={testing}>
            {testing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Play className="mr-1.5 h-4 w-4" />}
            Testar
          </Button>
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
                  <Badge variant="outline">{rule.conditions.length} condição(ões)</Badge>
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
                    <p className="text-xs text-muted-foreground">Regras inativas são ignoradas pelo engine.</p>
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
                    <p className="text-sm font-medium">Condições</p>
                    <Button size="sm" variant="outline" onClick={() => addCondition(rule.id)}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Condição
                    </Button>
                  </div>

                  {rule.conditions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sem condições: aplica para todos os leads.</p>
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
                  <p className="text-sm font-medium">Atribuição</p>
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
                      <option value="fixed_user">Usuário fixo</option>
                      <option value="none">Sem atribuição</option>
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
                        <option value="">Selecione o usuário</option>
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
