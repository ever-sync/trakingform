'use client'

import { useEffect, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

interface WorkspaceEmailSettings {
  provider: string | null
  fallback_provider: string | null
  default_from_name: string | null
  default_from_email: string | null
  default_reply_to: string | null
  email_core_enabled: boolean
  email_recovery_enabled: boolean
  email_campaigns_enabled: boolean
  marketing_requires_consent: boolean
}

const EMPTY_SETTINGS: WorkspaceEmailSettings = {
  provider: 'resend',
  fallback_provider: null,
  default_from_name: '',
  default_from_email: '',
  default_reply_to: '',
  email_core_enabled: true,
  email_recovery_enabled: true,
  email_campaigns_enabled: true,
  marketing_requires_consent: true,
}

export function EmailSettingsClient() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<WorkspaceEmailSettings>(EMPTY_SETTINGS)

  useEffect(() => {
    fetch('/api/workspace/email-settings')
      .then((res) => res.json())
      .then((data) => {
        if (data?.settings) {
          setSettings({
            provider: data.settings.provider ?? 'resend',
            fallback_provider: data.settings.fallback_provider ?? null,
            default_from_name: data.settings.default_from_name ?? '',
            default_from_email: data.settings.default_from_email ?? '',
            default_reply_to: data.settings.default_reply_to ?? '',
            email_core_enabled: !!data.settings.email_core_enabled,
            email_recovery_enabled: !!data.settings.email_recovery_enabled,
            email_campaigns_enabled: !!data.settings.email_campaigns_enabled,
            marketing_requires_consent: data.settings.marketing_requires_consent !== false,
          })
        }
      })
      .catch(() => toast.error('Erro ao carregar configuracoes de e-mail.'))
      .finally(() => setLoading(false))
  }, [])

  async function saveSettings() {
    setSaving(true)
    try {
      const res = await fetch('/api/workspace/email-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || 'Falha ao salvar')

      toast.success('Configuracoes de e-mail salvas.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar configuracoes')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Configuração de envio</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Provider</Label>
            <Input value={settings.provider ?? 'resend'} disabled />
          </div>
          <div className="space-y-1.5">
            <Label>Fallback provider</Label>
            <Input
              placeholder="ex: postmark"
              value={settings.fallback_provider ?? ''}
              onChange={(event) => setSettings((prev) => ({ ...prev, fallback_provider: event.target.value || null }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Default from name</Label>
            <Input
              value={settings.default_from_name ?? ''}
              onChange={(event) => setSettings((prev) => ({ ...prev, default_from_name: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Default from email</Label>
            <Input
              type="email"
              value={settings.default_from_email ?? ''}
              onChange={(event) => setSettings((prev) => ({ ...prev, default_from_email: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Default reply-to</Label>
            <Input
              type="email"
              value={settings.default_reply_to ?? ''}
              onChange={(event) => setSettings((prev) => ({ ...prev, default_reply_to: event.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-3 rounded-lg border p-3">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Email core habilitado</span>
            <Switch
              checked={settings.email_core_enabled}
              onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, email_core_enabled: checked }))}
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Recovery por e-mail habilitado</span>
            <Switch
              checked={settings.email_recovery_enabled}
              onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, email_recovery_enabled: checked }))}
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Campanhas por e-mail habilitadas</span>
            <Switch
              checked={settings.email_campaigns_enabled}
              onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, email_campaigns_enabled: checked }))}
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Marketing exige consentimento</span>
            <Switch
              checked={settings.marketing_requires_consent}
              onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, marketing_requires_consent: checked }))}
            />
          </label>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => void saveSettings()} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
