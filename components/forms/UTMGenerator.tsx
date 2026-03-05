'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ExternalLink, Link2, Plus, RefreshCw, Trash2 } from 'lucide-react'

interface UTMGeneratorProps {
  appUrl: string
  formId: string
  formName: string
}

interface CustomParam {
  id: string
  key: string
  value: string
}

interface Preset {
  label: string
  source: string
  medium: string
}

const PRESETS: Preset[] = [
  { label: 'Google Ads', source: 'google', medium: 'cpc' },
  { label: 'Meta Ads', source: 'facebook', medium: 'paid_social' },
  { label: 'Instagram Org', source: 'instagram', medium: 'social' },
  { label: 'Email', source: 'newsletter', medium: 'email' },
  { label: 'WhatsApp', source: 'whatsapp', medium: 'chat' },
]

function normalizeValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '_')
}

function slugify(value: string) {
  return normalizeValue(value)
    .replace(/[^a-z0-9_\-]/g, '')
    .replace(/_+/g, '_')
}

async function copyWithFallback(text: string) {
  if (!text) return false

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fallback below
  }

  try {
    const input = document.createElement('textarea')
    input.value = text
    input.style.position = 'fixed'
    input.style.opacity = '0'
    document.body.appendChild(input)
    input.focus()
    input.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(input)
    return ok
  } catch {
    return false
  }
}

export function UTMGenerator({ appUrl, formId, formName }: UTMGeneratorProps) {
  const [baseUrl, setBaseUrl] = useState(`${appUrl}/embed/${formId}`)
  const [utmSource, setUtmSource] = useState('')
  const [utmMedium, setUtmMedium] = useState('')
  const [utmCampaign, setUtmCampaign] = useState('')
  const [utmContent, setUtmContent] = useState('')
  const [utmTerm, setUtmTerm] = useState('')
  const [customParams, setCustomParams] = useState<CustomParam[]>([])

  const missingRequired = useMemo(() => {
    const missing: string[] = []
    if (!utmSource.trim()) missing.push('utm_source')
    if (!utmMedium.trim()) missing.push('utm_medium')
    if (!utmCampaign.trim()) missing.push('utm_campaign')
    return missing
  }, [utmCampaign, utmMedium, utmSource])

  const generatedUrl = useMemo(() => {
    try {
      const url = new URL(baseUrl)

      const params: Record<string, string> = {
        utm_source: slugify(utmSource),
        utm_medium: slugify(utmMedium),
        utm_campaign: slugify(utmCampaign),
        utm_content: slugify(utmContent),
        utm_term: slugify(utmTerm),
      }

      Object.entries(params).forEach(([key, value]) => {
        if (!value) {
          url.searchParams.delete(key)
          return
        }
        url.searchParams.set(key, value)
      })

      customParams.forEach((param) => {
        const key = slugify(param.key)
        const value = normalizeValue(param.value)
        if (!key || !value) return
        url.searchParams.set(key, value)
      })

      return url.toString()
    } catch {
      return ''
    }
  }, [baseUrl, customParams, utmCampaign, utmContent, utmMedium, utmSource, utmTerm])

  async function handleCopyUrl() {
    if (!generatedUrl) {
      toast.error('URL invalida. Ajuste o link base.')
      return
    }

    const ok = await copyWithFallback(generatedUrl)
    if (!ok) {
      toast.error('Nao foi possivel copiar.')
      return
    }

    toast.success('Link UTM copiado.')
  }

  function applyPreset(preset: Preset) {
    setUtmSource(preset.source)
    setUtmMedium(preset.medium)
  }

  function autoCampaign() {
    const today = new Date()
    const date = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
    setUtmCampaign(slugify(`${formName}_${date}`))
  }

  function addCustomParam() {
    setCustomParams((prev) => [
      ...prev,
      { id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, key: '', value: '' },
    ])
  }

  function removeCustomParam(id: string) {
    setCustomParams((prev) => prev.filter((item) => item.id !== id))
  }

  function updateCustomParam(id: string, patch: Partial<CustomParam>) {
    setCustomParams((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  function resetAll() {
    setUtmSource('')
    setUtmMedium('')
    setUtmCampaign('')
    setUtmContent('')
    setUtmTerm('')
    setCustomParams([])
    setBaseUrl(`${appUrl}/embed/${formId}`)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Gerador de UTM (Profissional)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="utm-base-url">URL base de destino</Label>
          <Input
            id="utm-base-url"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder={`${appUrl}/embed/${formId}`}
          />
          <p className="text-xs text-muted-foreground">Pode usar embed, landing page ou qualquer URL do seu funil.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <Button key={preset.label} size="sm" variant="outline" onClick={() => applyPreset(preset)}>
              {preset.label}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={autoCampaign}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            Campanha automatica
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="utm-source">utm_source *</Label>
            <Input id="utm-source" value={utmSource} onChange={(event) => setUtmSource(event.target.value)} placeholder="google" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="utm-medium">utm_medium *</Label>
            <Input id="utm-medium" value={utmMedium} onChange={(event) => setUtmMedium(event.target.value)} placeholder="cpc" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="utm-campaign">utm_campaign *</Label>
            <Input id="utm-campaign" value={utmCampaign} onChange={(event) => setUtmCampaign(event.target.value)} placeholder="lancamento_marco" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="utm-content">utm_content</Label>
            <Input id="utm-content" value={utmContent} onChange={(event) => setUtmContent(event.target.value)} placeholder="criativo_a" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="utm-term">utm_term</Label>
            <Input id="utm-term" value={utmTerm} onChange={(event) => setUtmTerm(event.target.value)} placeholder="seguro_de_vida" />
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-gray-200 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Parametros customizados</p>
            <Button size="sm" variant="outline" onClick={addCustomParam}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Adicionar parametro
            </Button>
          </div>

          {customParams.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem parametros extras.</p>
          ) : (
            <div className="space-y-2">
              {customParams.map((param) => (
                <div key={param.id} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]">
                  <Input
                    value={param.key}
                    onChange={(event) => updateCustomParam(param.id, { key: event.target.value })}
                    placeholder="nome_parametro"
                  />
                  <Input
                    value={param.value}
                    onChange={(event) => updateCustomParam(param.id, { value: event.target.value })}
                    placeholder="valor"
                  />
                  <Button variant="outline" size="icon" onClick={() => removeCustomParam(param.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50/60 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-gray-900">Link final rastreado</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={resetAll}>Limpar</Button>
              <Button size="sm" variant="outline" onClick={() => void handleCopyUrl()}>
                <Link2 className="mr-1 h-3.5 w-3.5" />
                Copiar link
              </Button>
              <Button size="sm" asChild>
                <a href={generatedUrl || '#'} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1 h-3.5 w-3.5" />
                  Testar
                </a>
              </Button>
            </div>
          </div>

          <pre className="overflow-x-auto rounded bg-gray-900 p-3 text-xs text-green-400">{generatedUrl || 'URL invalida'}</pre>

          {missingRequired.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
                Recomendada: preencha {missingRequired.join(', ')}
              </Badge>
            </div>
          ) : (
            <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50">
              UTM pronta para uso
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
