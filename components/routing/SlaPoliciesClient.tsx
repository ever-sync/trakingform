'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, Save, Trash2 } from 'lucide-react'

interface SlaPolicy {
  id: string
  name: string
  is_active: boolean
  first_response_minutes: number
  escalation_minutes: number
}

export function SlaPoliciesClient() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [policies, setPolicies] = useState<SlaPolicy[]>([])

  useEffect(() => {
    fetch('/api/routing/sla/policies')
      .then((res) => res.json())
      .then((data) => setPolicies(Array.isArray(data.policies) ? data.policies : []))
      .catch(() => toast.error('Erro ao carregar políticas SLA.'))
      .finally(() => setLoading(false))
  }, [])

  function addPolicy() {
    setPolicies((prev) => ([
      ...prev,
      {
        id: `tmp_${Date.now()}`,
        name: 'SLA padrão',
        is_active: true,
        first_response_minutes: 15,
        escalation_minutes: 60,
      },
    ]))
  }

  async function savePolicy(policy: SlaPolicy) {
    setSaving(policy.id)
    try {
      const res = await fetch('/api/routing/sla/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(policy.id.startsWith('tmp_') ? {} : { id: policy.id }),
          name: policy.name,
          is_active: policy.is_active,
          first_response_minutes: policy.first_response_minutes,
          escalation_minutes: policy.escalation_minutes,
          channels: ['whatsapp', 'email'],
        }),
      })
      if (!res.ok) throw new Error('Falha ao salvar')
      const saved = await res.json()
      setPolicies((prev) => prev.map((item) => (item.id === policy.id ? { ...item, ...saved } : item)))
      toast.success('Política SLA salva.')
    } catch {
      toast.error('Nao foi possivel salvar política SLA.')
    } finally {
      setSaving(null)
    }
  }

  async function removePolicy(policy: SlaPolicy) {
    if (policy.id.startsWith('tmp_')) {
      setPolicies((prev) => prev.filter((item) => item.id !== policy.id))
      return
    }

    setSaving(policy.id)
    try {
      const res = await fetch('/api/routing/sla/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: policy.id, delete: true }),
      })
      if (!res.ok) throw new Error('Falha ao remover')
      setPolicies((prev) => prev.filter((item) => item.id !== policy.id))
      toast.success('Política SLA removida.')
    } catch {
      toast.error('Nao foi possivel remover política SLA.')
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" onClick={addPolicy}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nova política SLA
        </Button>
      </div>

      {policies.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhuma política SLA configurada.</CardContent>
        </Card>
      ) : (
        policies.map((policy) => (
          <Card key={policy.id}>
            <CardHeader>
              <CardTitle className="text-base">{policy.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input
                    value={policy.name}
                    onChange={(event) => setPolicies((prev) => prev.map((item) => (item.id === policy.id ? { ...item, name: event.target.value } : item)))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Primeiro contato (min)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={policy.first_response_minutes}
                    onChange={(event) => setPolicies((prev) => prev.map((item) => (item.id === policy.id ? { ...item, first_response_minutes: Number(event.target.value) || 15 } : item)))}
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Escalonamento (min)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={policy.escalation_minutes}
                    onChange={(event) => setPolicies((prev) => prev.map((item) => (item.id === policy.id ? { ...item, escalation_minutes: Number(event.target.value) || 60 } : item)))}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={policy.is_active}
                  onChange={(event) => setPolicies((prev) => prev.map((item) => (item.id === policy.id ? { ...item, is_active: event.target.checked } : item)))}
                />
                Ativa
              </label>

              <div className="flex gap-2">
                <Button onClick={() => void savePolicy(policy)} disabled={saving === policy.id}>
                  {saving === policy.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                  Salvar
                </Button>
                <Button variant="outline" onClick={() => void removePolicy(policy)} disabled={saving === policy.id}>
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Apagar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
