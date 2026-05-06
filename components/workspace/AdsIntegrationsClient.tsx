'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Save } from 'lucide-react'

type Platform = 'google_ads' | 'meta_ads'

interface PlatformConfig {
  id?: string
  platform: Platform
  is_active: boolean
  credentials: Record<string, unknown>
  settings: Record<string, unknown>
}

interface ConfigResponseItem {
  id?: string
  platform?: string
  is_active?: boolean | null
  credentials?: unknown
  settings?: unknown
}

const EMPTY_CONFIG: Record<Platform, PlatformConfig> = {
  google_ads: { platform: 'google_ads', is_active: false, credentials: {}, settings: {} },
  meta_ads: { platform: 'meta_ads', is_active: false, credentials: {}, settings: {} },
}

export function AdsIntegrationsClient() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<Platform | null>(null)
  const [configs, setConfigs] = useState<Record<Platform, PlatformConfig>>(EMPTY_CONFIG)

  useEffect(() => {
    fetch('/api/integrations/ads/config')
      .then((res) => res.json())
      .then((data) => {
        const next: Record<Platform, PlatformConfig> = {
          google_ads: { ...EMPTY_CONFIG.google_ads },
          meta_ads: { ...EMPTY_CONFIG.meta_ads },
        }

        const rows = Array.isArray(data.configs) ? (data.configs as ConfigResponseItem[]) : []
        rows.forEach((row: ConfigResponseItem) => {
          if (row.platform === 'google_ads' || row.platform === 'meta_ads') {
            const platform = row.platform as Platform
            next[platform] = {
              id: row.id,
              platform,
              is_active: row.is_active !== false,
              credentials: (row.credentials && typeof row.credentials === 'object' && !Array.isArray(row.credentials))
                ? row.credentials as Record<string, unknown>
                : {},
              settings: (row.settings && typeof row.settings === 'object' && !Array.isArray(row.settings))
                ? row.settings as Record<string, unknown>
                : {},
            }
          }
        })

        setConfigs(next)
      })
      .catch(() => toast.error('Erro ao carregar configuracoes de Ads.'))
      .finally(() => setLoading(false))
  }, [])

  async function save(platform: Platform) {
    setSaving(platform)
    try {
      const cfg = configs[platform]
      const res = await fetch('/api/integrations/ads/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      })
      if (!res.ok) throw new Error('Falha ao salvar')
      const saved = await res.json()
      setConfigs((prev) => ({
        ...prev,
        [platform]: {
          ...prev[platform],
          id: saved.id,
        },
      }))
      toast.success(`Configuração de ${platform} salva.`)
    } catch {
      toast.error('Não foi possível salvar configuração.')
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {(['google_ads', 'meta_ads'] as Platform[]).map((platform) => {
        const cfg = configs[platform]
        const keyLabel = platform === 'google_ads' ? 'Customer ID' : 'Pixel ID'
        const tokenLabel = platform === 'google_ads' ? 'Conversion Action' : 'Access Token'

        return (
          <Card key={platform}>
            <CardHeader>
              <CardTitle className="text-base">{platform === 'google_ads' ? 'Google Ads' : 'Meta Ads'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={cfg.is_active}
                  onChange={(event) =>
                    setConfigs((prev) => ({
                      ...prev,
                      [platform]: {
                        ...prev[platform],
                        is_active: event.target.checked,
                      },
                    }))
                  }
                />
                Ativar integração
              </label>

              <div className="space-y-1.5">
                <Label>{keyLabel}</Label>
                <Input
                  value={String(cfg.credentials.primary_id ?? '')}
                  onChange={(event) =>
                    setConfigs((prev) => ({
                      ...prev,
                      [platform]: {
                        ...prev[platform],
                        credentials: { ...prev[platform].credentials, primary_id: event.target.value },
                      },
                    }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>{tokenLabel}</Label>
                <Input
                  value={String(cfg.credentials.secret ?? '')}
                  onChange={(event) =>
                    setConfigs((prev) => ({
                      ...prev,
                      [platform]: {
                        ...prev[platform],
                        credentials: { ...prev[platform].credentials, secret: event.target.value },
                      },
                    }))
                  }
                />
              </div>

              <Button onClick={() => void save(platform)} disabled={saving === platform}>
                {saving === platform ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                Salvar
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
