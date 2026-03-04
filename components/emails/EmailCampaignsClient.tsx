'use client'

import { useState } from 'react'
import { Loader2, Play, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface CampaignTemplateOption {
  id: string
  name: string
}

interface CampaignItem {
  id: string
  name: string
  status: string | null
  email_type: string | null
  total_recipients: number | null
  sent_count: number | null
  opened_count: number | null
  clicked_count: number | null
  bounced_count: number | null
  created_at: string | null
  template: {
    id: string
    name: string
    subject: string
  } | null
}

export function EmailCampaignsClient({
  templates,
  campaigns: initialCampaigns,
}: {
  templates: CampaignTemplateOption[]
  campaigns: CampaignItem[]
}) {
  const [campaigns, setCampaigns] = useState(initialCampaigns)
  const [creating, setCreating] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    template_id: templates[0]?.id ?? '',
    email_type: 'marketing',
  })

  async function createCampaign() {
    if (!form.name.trim() || !form.template_id) {
      toast.error('Informe nome e template da campanha.')
      return
    }

    setCreating(true)
    try {
      const res = await fetch('/api/email-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || 'Falha ao criar campanha')

      const template = templates.find((item) => item.id === payload.template_id)
      setCampaigns((prev) => ([{
        ...payload,
        template: template ? { id: template.id, name: template.name, subject: '' } : null,
      }, ...prev]))

      setForm((prev) => ({ ...prev, name: '' }))
      toast.success('Campanha criada.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar campanha')
    } finally {
      setCreating(false)
    }
  }

  async function sendCampaign(campaignId: string) {
    setSendingId(campaignId)
    try {
      const res = await fetch(`/api/email-campaigns/${campaignId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processNow: true }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || 'Falha ao enviar campanha')

      setCampaigns((prev) => prev.map((item) => (
        item.id === campaignId
          ? {
              ...item,
              status: 'sending',
              total_recipients: payload.recipients ?? item.total_recipients,
              sent_count: payload.processing?.sent ?? item.sent_count,
            }
          : item
      )))

      toast.success(`Campanha enfileirada para ${payload.recipients ?? 0} lead(s).`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar campanha')
    } finally {
      setSendingId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Campanhas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label>Nome da campanha</Label>
            <Input
              placeholder="Ex: Follow-up semanal"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Template</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={form.template_id}
              onChange={(event) => setForm((prev) => ({ ...prev, template_id: event.target.value }))}
            >
              {templates.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={form.email_type}
              onChange={(event) => setForm((prev) => ({ ...prev, email_type: event.target.value }))}
            >
              <option value="marketing">Marketing</option>
              <option value="transactional">Transacional</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => void createCampaign()} disabled={creating || templates.length === 0}>
            {creating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
            Nova campanha
          </Button>
        </div>

        {campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma campanha criada.</p>
        ) : (
          <div className="space-y-2">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900">{campaign.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Template: {campaign.template?.name ?? '-'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{campaign.status ?? 'draft'}</Badge>
                    <Badge variant="secondary">{campaign.email_type ?? 'marketing'}</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void sendCampaign(campaign.id)}
                      disabled={sendingId === campaign.id}
                    >
                      {sendingId === campaign.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
                      Enviar
                    </Button>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground md:grid-cols-5">
                  <p>Recipients: {campaign.total_recipients ?? 0}</p>
                  <p>Sent: {campaign.sent_count ?? 0}</p>
                  <p>Opened: {campaign.opened_count ?? 0}</p>
                  <p>Clicked: {campaign.clicked_count ?? 0}</p>
                  <p>Bounced: {campaign.bounced_count ?? 0}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
