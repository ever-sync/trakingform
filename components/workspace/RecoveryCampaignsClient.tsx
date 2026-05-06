'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Plus, Play, Save, Trash2 } from 'lucide-react'

interface RecoveryCampaign {
  id: string
  name: string
  is_active: boolean
  channel: string
  delay_minutes: number
  message_template: string
}

export function RecoveryCampaignsClient() {
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [campaigns, setCampaigns] = useState<RecoveryCampaign[]>([])

  useEffect(() => {
    fetch('/api/recovery/campaigns')
      .then((res) => res.json())
      .then((data) => setCampaigns(Array.isArray(data.campaigns) ? data.campaigns : []))
      .catch(() => toast.error('Erro ao carregar campanhas.'))
      .finally(() => setLoading(false))
  }, [])

  function addCampaign() {
    setCampaigns((prev) => ([
      ...prev,
      {
        id: `tmp_${Date.now()}`,
        name: 'Nova campanha',
        is_active: true,
        channel: 'whatsapp',
        delay_minutes: 30,
        message_template: 'Você quase concluiu seu cadastro. Retome por aqui: {{resume_url}}',
      },
    ]))
  }

  async function save(campaign: RecoveryCampaign) {
    setSavingId(campaign.id)
    try {
      const res = await fetch('/api/recovery/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(campaign.id.startsWith('tmp_') ? {} : { id: campaign.id }),
          name: campaign.name,
          is_active: campaign.is_active,
          channel: campaign.channel,
          delay_minutes: campaign.delay_minutes,
          message_template: campaign.message_template,
        }),
      })
      if (!res.ok) throw new Error('Falha ao salvar')
      const saved = await res.json()
      setCampaigns((prev) => prev.map((item) => (item.id === campaign.id ? { ...item, ...saved } : item)))
      toast.success('Campanha salva.')
    } catch {
      toast.error('Nao foi possivel salvar campanha.')
    } finally {
      setSavingId(null)
    }
  }

  async function remove(campaign: RecoveryCampaign) {
    if (campaign.id.startsWith('tmp_')) {
      setCampaigns((prev) => prev.filter((item) => item.id !== campaign.id))
      return
    }

    setSavingId(campaign.id)
    try {
      const res = await fetch('/api/recovery/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: campaign.id, delete: true }),
      })
      if (!res.ok) throw new Error('Falha ao apagar')
      setCampaigns((prev) => prev.filter((item) => item.id !== campaign.id))
      toast.success('Campanha apagada.')
    } catch {
      toast.error('Nao foi possivel apagar campanha.')
    } finally {
      setSavingId(null)
    }
  }

  async function runNow() {
    try {
      const res = await fetch('/api/recovery/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run_now: true }),
      })
      if (!res.ok) throw new Error('Falha ao executar')
      const data = await res.json()
      toast.success(`Recovery executado: ${data.sent ?? 0} envio(s) + ${data.queuedEmail ?? 0} e-mail(s) na fila.`)
    } catch {
      toast.error('Nao foi possivel executar recovery.')
    }
  }

  if (loading) {
    return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-end">
        <Button variant="outline" onClick={() => void runNow()}>
          <Play className="mr-1.5 h-4 w-4" />
          Executar agora
        </Button>
        <Button onClick={addCampaign}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nova campanha
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma campanha criada.
          </CardContent>
        </Card>
      ) : (
        campaigns.map((campaign) => (
          <Card key={campaign.id}>
            <CardHeader>
              <CardTitle className="text-base">{campaign.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input
                    value={campaign.name}
                    onChange={(event) => setCampaigns((prev) => prev.map((item) => (item.id === campaign.id ? { ...item, name: event.target.value } : item)))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Canal</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={campaign.channel}
                    onChange={(event) => setCampaigns((prev) => prev.map((item) => (item.id === campaign.id ? { ...item, channel: event.target.value } : item)))}
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">E-mail</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Delay (minutos)</Label>
                <Input
                  type="number"
                  min={1}
                  value={campaign.delay_minutes}
                  onChange={(event) => setCampaigns((prev) => prev.map((item) => (item.id === campaign.id ? { ...item, delay_minutes: Number(event.target.value) || 30 } : item)))}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Mensagem</Label>
                <Textarea
                  rows={3}
                  value={campaign.message_template}
                  onChange={(event) => setCampaigns((prev) => prev.map((item) => (item.id === campaign.id ? { ...item, message_template: event.target.value } : item)))}
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={campaign.is_active}
                  onChange={(event) => setCampaigns((prev) => prev.map((item) => (item.id === campaign.id ? { ...item, is_active: event.target.checked } : item)))}
                />
                Ativa
              </label>

              <div className="flex gap-2">
                <Button onClick={() => void save(campaign)} disabled={savingId === campaign.id}>
                  {savingId === campaign.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                  Salvar
                </Button>
                <Button variant="outline" onClick={() => void remove(campaign)} disabled={savingId === campaign.id}>
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
