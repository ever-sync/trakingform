'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, MessageCircle, Save } from 'lucide-react'

interface WhatsAppConfig {
  id: string
  instance_name: string
  api_url: string
  api_key: string
  notify_number: string
  min_score: number
  is_active: boolean
  message_template: string
}

export default function WhatsAppConfigPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState({
    instance_name: '',
    api_url: '',
    api_key: '',
    notify_number: '',
    min_score: 70,
    is_active: true,
    message_template: 'Novo lead quente! {{name}} ({{email}}) - Score: {{score}}',
  })

  useEffect(() => {
    fetch('/api/whatsapp/config')
      .then(r => r.json())
      .then(data => {
        if (data && data.id) {
          setConfig({
            instance_name: data.instance_name || '',
            api_url: data.api_url || '',
            api_key: data.api_key || '',
            notify_number: data.notify_number || '',
            min_score: data.min_score ?? 70,
            is_active: data.is_active !== false,
            message_template: data.message_template || '',
          })
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Configuracao salva!')
    } catch {
      toast.error('Erro ao salvar configuracao.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">WhatsApp Alerts</h1>
        <p className="text-muted-foreground">Configure notificacoes via Evolution API quando leads quentes chegarem.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            Evolution API
          </CardTitle>
          <CardDescription>
            Conecte sua instancia da Evolution API para receber alertas no WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome da instancia</Label>
              <Input
                placeholder="minha-instancia"
                value={config.instance_name}
                onChange={e => setConfig(prev => ({ ...prev, instance_name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">URL da API</Label>
              <Input
                placeholder="https://evolution.suaurl.com"
                value={config.api_url}
                onChange={e => setConfig(prev => ({ ...prev, api_url: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">API Key</Label>
            <Input
              type="password"
              placeholder="Chave de API da Evolution"
              value={config.api_key}
              onChange={e => setConfig(prev => ({ ...prev, api_key: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Numero para notificacao</Label>
              <Input
                placeholder="5511999999999"
                value={config.notify_number}
                onChange={e => setConfig(prev => ({ ...prev, notify_number: e.target.value }))}
              />
              <p className="text-[11px] text-muted-foreground">Formato: codigo do pais + DDD + numero</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Score minimo para alerta</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={config.min_score}
                onChange={e => setConfig(prev => ({ ...prev, min_score: Number(e.target.value) }))}
              />
              <p className="text-[11px] text-muted-foreground">Leads com score acima deste valor serao notificados</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Template da mensagem</Label>
            <Input
              value={config.message_template}
              onChange={e => setConfig(prev => ({ ...prev, message_template: e.target.value }))}
            />
            <p className="text-[11px] text-muted-foreground">
              {'Variaveis disponiveis: {{name}}, {{email}}, {{phone}}, {{score}}'}
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={config.is_active}
              onChange={e => setConfig(prev => ({ ...prev, is_active: e.target.checked }))}
              className="rounded border-gray-300"
            />
            Ativar notificacoes WhatsApp
          </label>

          <Button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar configuracao
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
