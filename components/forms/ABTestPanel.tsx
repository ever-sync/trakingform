'use client'

import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Copy, Download, Loader2, Plus, RotateCcw, Save, Trash2, Upload } from 'lucide-react'

interface VariantRow {
  id: string
  name: string
  weight: number | null
  total_views: number | null
  total_submissions: number | null
  is_active: boolean | null
  fields?: unknown
  settings?: unknown
  theme?: unknown
}

interface AutoWinnerConfig {
  enabled: boolean
  minDays: number
  minViews: number
  appliedAt: string | null
  winnerVariantId: string | null
  lastEvaluatedAt: string | null
}

interface ABTestPanelProps {
  formId: string
  baseFields: unknown[]
  baseSettings: unknown
  baseTheme: unknown
  defaultFields: unknown[]
  defaultSettings: unknown
  defaultTheme: unknown
  autoWinnerConfig: AutoWinnerConfig
  onAutoWinnerConfigChange: (nextConfig: AutoWinnerConfig) => void
  onLoadVariant?: (variant: { fields: unknown; settings: unknown; theme: unknown; name: string }) => void
}

export function ABTestPanel({
  formId,
  baseFields,
  baseSettings,
  baseTheme,
  defaultFields,
  defaultSettings,
  defaultTheme,
  autoWinnerConfig,
  onAutoWinnerConfigChange,
  onLoadVariant,
}: ABTestPanelProps) {
  const [variants, setVariants] = useState<VariantRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newVariantName, setNewVariantName] = useState('')
  const minWinnerViews = Math.max(1, autoWinnerConfig.minViews || 100)

  const totalWeight = useMemo(
    () => variants.filter((v) => v.is_active !== false).reduce((sum, variant) => sum + Number(variant.weight ?? 0), 0),
    [variants]
  )
  const totalViews = useMemo(
    () => variants.reduce((sum, variant) => sum + Number(variant.total_views ?? 0), 0),
    [variants]
  )
  const maxConversion = useMemo(
    () =>
      Math.max(
        1,
        ...variants.map((variant) => {
          const views = variant.total_views ?? 0
          const submissions = variant.total_submissions ?? 0
          return views > 0 ? (submissions / views) * 100 : 0
        })
      ),
    [variants]
  )
  const winnerCandidate = useMemo(() => {
    return (
      variants
        .filter((variant) => (variant.is_active ?? true) && (variant.total_views ?? 0) >= minWinnerViews)
        .sort((a, b) => {
          const aViews = a.total_views ?? 0
          const bViews = b.total_views ?? 0
          const aSubmissions = a.total_submissions ?? 0
          const bSubmissions = b.total_submissions ?? 0
          const aConversion = aViews > 0 ? aSubmissions / aViews : 0
          const bConversion = bViews > 0 ? bSubmissions / bViews : 0
          if (bConversion !== aConversion) return bConversion - aConversion
          return bViews - aViews
        })[0] ?? null
    )
  }, [variants])

  async function loadVariants() {
    setLoading(true)
    try {
      const res = await fetch(`/api/forms/${formId}/variants`)
      if (!res.ok) throw new Error('Falha ao carregar variantes')
      const data = (await res.json()) as VariantRow[]
      setVariants(data)
    } catch (error) {
      console.error(error)
      toast.error('Erro ao carregar variantes A/B')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadVariants()
  }, [formId])

  async function createVariant() {
    const name = newVariantName.trim() || `Variante ${variants.length + 2}`
    setCreating(true)
    try {
      const res = await fetch(`/api/forms/${formId}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          fields: baseFields,
          settings: baseSettings,
          theme: baseTheme,
          weight: 50,
        }),
      })
      if (!res.ok) throw new Error('Falha ao criar variante')
      const created = (await res.json()) as VariantRow
      setVariants((prev) => [...prev, created])
      setNewVariantName('')
      toast.success('Variante criada')
    } catch (error) {
      console.error(error)
      toast.error('Erro ao criar variante')
    } finally {
      setCreating(false)
    }
  }

  async function saveVariant(variant: VariantRow) {
    setSavingId(variant.id)
    try {
      const res = await fetch(`/api/forms/${formId}/variants`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId: variant.id,
          name: variant.name,
          weight: Number(variant.weight ?? 0),
          is_active: variant.is_active !== false,
        }),
      })

      if (!res.ok) throw new Error('Falha ao salvar variante')
      const updated = (await res.json()) as VariantRow
      setVariants((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      toast.success('Variante atualizada')
    } catch (error) {
      console.error(error)
      toast.error('Erro ao atualizar variante')
    } finally {
      setSavingId(null)
    }
  }

  async function updateVariantContent(variant: VariantRow) {
    setSavingId(variant.id)
    try {
      const res = await fetch(`/api/forms/${formId}/variants`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId: variant.id,
          fields: baseFields,
          settings: baseSettings,
          theme: baseTheme,
        }),
      })
      if (!res.ok) throw new Error('Falha ao atualizar conteudo da variante')
      const updated = (await res.json()) as VariantRow
      setVariants((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      toast.success('Conteudo importado do builder')
    } catch (error) {
      console.error(error)
      toast.error('Erro ao importar conteudo do builder')
    } finally {
      setSavingId(null)
    }
  }

  async function resetVariantContent(variant: VariantRow) {
    setSavingId(variant.id)
    try {
      const res = await fetch(`/api/forms/${formId}/variants`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId: variant.id,
          fields: defaultFields,
          settings: defaultSettings,
          theme: defaultTheme,
        }),
      })
      if (!res.ok) throw new Error('Falha ao resetar variante')
      const updated = (await res.json()) as VariantRow
      setVariants((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      toast.success('Variante resetada para base')
    } catch (error) {
      console.error(error)
      toast.error('Erro ao resetar variante')
    } finally {
      setSavingId(null)
    }
  }

  async function duplicateVariant(variant: VariantRow) {
    setSavingId(variant.id)
    try {
      const res = await fetch(`/api/forms/${formId}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${variant.name} (Copia)`,
          fields: variant.fields ?? baseFields,
          settings: variant.settings ?? baseSettings,
          theme: variant.theme ?? baseTheme,
          weight: variant.weight ?? 50,
        }),
      })
      if (!res.ok) throw new Error('Falha ao duplicar variante')
      const created = (await res.json()) as VariantRow
      setVariants((prev) => [...prev, created])
      toast.success('Variante duplicada')
    } catch (error) {
      console.error(error)
      toast.error('Erro ao duplicar variante')
    } finally {
      setSavingId(null)
    }
  }

  async function deleteVariant(variantId: string) {
    setSavingId(variantId)
    try {
      const res = await fetch(`/api/forms/${formId}/variants?variantId=${variantId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Falha ao remover variante')
      setVariants((prev) => prev.filter((variant) => variant.id !== variantId))
      toast.success('Variante removida')
    } catch (error) {
      console.error(error)
      toast.error('Erro ao remover variante')
    } finally {
      setSavingId(null)
    }
  }

  async function applyWinner() {
    if (!winnerCandidate) {
      toast.error(`Nenhuma vencedora com amostra minima de ${minWinnerViews} views`)
      return
    }

    setSavingId('apply-winner')
    try {
      const response = await fetch(`/api/forms/${formId}/variants/apply-winner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winnerVariantId: winnerCandidate.id }),
      })

      const result = (await response.json()) as {
        winnerName?: string | null
        timelineEventsInserted?: number
      }

      if (!response.ok) throw new Error('Falha ao aplicar vencedora')

      await loadVariants()
      toast.success(
        `Vencedora aplicada: ${result.winnerName ?? winnerCandidate.name} (${result.timelineEventsInserted ?? 0} eventos na timeline)`
      )
    } catch (error) {
      console.error(error)
      toast.error('Erro ao aplicar vencedora')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">A/B Testing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Nome da variante"
            value={newVariantName}
            onChange={(event) => setNewVariantName(event.target.value)}
            className="h-8 w-full sm:max-w-[280px] text-xs"
          />
          <Button size="sm" className="h-8 text-xs" onClick={createVariant} disabled={creating}>
            {creating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
            Nova variante
          </Button>
          <Badge variant="outline" className="text-[11px]">
            Peso total ativo: {totalWeight}%
          </Badge>
          {totalWeight !== 100 && variants.length > 0 ? (
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[11px] text-amber-800">
              Recomendado: 100%
            </Badge>
          ) : null}
          {winnerCandidate ? (
            <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-[11px] text-emerald-800">
              Vencedora: {winnerCandidate.name}
            </Badge>
          ) : (
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[11px] text-amber-800">
              Sem vencedora (min. {minWinnerViews} views)
            </Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => void applyWinner()}
            disabled={!winnerCandidate || savingId === 'apply-winner'}
          >
            {savingId === 'apply-winner' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Aplicar vencedora
          </Button>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs font-medium text-gray-700">Auto winner</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Aplica automaticamente a melhor variante quando atingir a regra de tempo e amostragem.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={autoWinnerConfig.enabled}
                onChange={(event) =>
                  onAutoWinnerConfigChange({
                    ...autoWinnerConfig,
                    enabled: event.target.checked,
                    appliedAt: event.target.checked ? null : autoWinnerConfig.appliedAt,
                    winnerVariantId: event.target.checked ? null : autoWinnerConfig.winnerVariantId,
                    lastEvaluatedAt: event.target.checked ? null : autoWinnerConfig.lastEvaluatedAt,
                  })
                }
                className="rounded border-gray-300"
              />
              <span className="font-medium text-gray-700">Ativar auto winner</span>
            </label>

            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-600">Dias min.</span>
              <Input
                type="number"
                min={1}
                max={365}
                value={autoWinnerConfig.minDays}
                onChange={(event) =>
                  onAutoWinnerConfigChange({
                    ...autoWinnerConfig,
                    minDays: Math.max(1, Math.min(365, Number(event.target.value) || 7)),
                    appliedAt: null,
                    winnerVariantId: null,
                    lastEvaluatedAt: null,
                  })
                }
                className="h-8 w-20 text-xs"
              />
            </div>

            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-600">Views min.</span>
              <Input
                type="number"
                min={1}
                max={1000000}
                value={autoWinnerConfig.minViews}
                onChange={(event) =>
                  onAutoWinnerConfigChange({
                    ...autoWinnerConfig,
                    minViews: Math.max(1, Math.min(1000000, Number(event.target.value) || 100)),
                    appliedAt: null,
                    winnerVariantId: null,
                    lastEvaluatedAt: null,
                  })
                }
                className="h-8 w-24 text-xs"
              />
            </div>

            {autoWinnerConfig.appliedAt ? (
              <Badge variant="outline" className="text-[11px]">
                Aplicado em {new Date(autoWinnerConfig.appliedAt).toLocaleDateString('pt-BR')}
              </Badge>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="py-4 text-xs text-muted-foreground">Carregando variantes...</div>
        ) : variants.length === 0 ? (
          <div className="py-4 text-xs text-muted-foreground">
            Nenhuma variante criada. Use o botao acima para iniciar um teste.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              {variants.map((variant) => {
                const views = variant.total_views ?? 0
                const submissions = variant.total_submissions ?? 0
                const conversion = views > 0 ? ((submissions / views) * 100).toFixed(1) : '0.0'

                return (
                  <div key={variant.id} className="rounded-lg border border-gray-200 bg-gray-50/60 p-2.5">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <Input
                        value={variant.name}
                        onChange={(event) =>
                          setVariants((prev) =>
                            prev.map((item) => (item.id === variant.id ? { ...item, name: event.target.value } : item))
                          )
                        }
                        className="h-8 text-xs"
                      />
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={variant.weight ?? 0}
                        onChange={(event) => {
                          const weight = Number(event.target.value)
                          setVariants((prev) =>
                            prev.map((item) =>
                              item.id === variant.id ? { ...item, weight: Number.isFinite(weight) ? weight : 0 } : item
                            )
                          )
                        }}
                        className="h-8 text-xs"
                      />
                      <div className="flex h-8 items-center text-xs text-gray-600">{views} views</div>
                      <div className="flex h-8 items-center text-xs text-gray-600">{submissions} leads</div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[10px]"
                        onClick={() =>
                          onLoadVariant?.({
                            fields: variant.fields ?? [],
                            settings: variant.settings ?? {},
                            theme: variant.theme ?? {},
                            name: variant.name,
                          })
                        }
                      >
                        <Download className="mr-1 h-3 w-3" />
                        Carregar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[10px]"
                        onClick={() => void updateVariantContent(variant)}
                        disabled={savingId === variant.id}
                      >
                        {savingId === variant.id ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <Upload className="mr-1 h-3 w-3" />
                        )}
                        Atualizar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[10px]"
                        onClick={() => void resetVariantContent(variant)}
                        disabled={savingId === variant.id}
                      >
                        <RotateCcw className="mr-1 h-3 w-3" />
                        Resetar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[10px]"
                        onClick={() => void duplicateVariant(variant)}
                        disabled={savingId === variant.id}
                      >
                        <Copy className="mr-1 h-3 w-3" />
                        Duplicar
                      </Button>
                      <label className="flex items-center gap-1 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          checked={variant.is_active !== false}
                          onChange={(event) =>
                            setVariants((prev) =>
                              prev.map((item) =>
                                item.id === variant.id ? { ...item, is_active: event.target.checked } : item
                              )
                            )
                          }
                        />
                        ativo
                      </label>
                      <Badge variant="secondary" className="h-6 text-[10px]">
                        {conversion}%
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2"
                        onClick={() => void saveVariant(variant)}
                        disabled={savingId === variant.id}
                      >
                        {savingId === variant.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-red-500 hover:text-red-600"
                        onClick={() => void deleteVariant(variant.id)}
                        disabled={savingId === variant.id}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="mb-2 text-xs font-medium text-gray-700">Comparativo de performance</p>
              <div className="space-y-2">
                {variants.map((variant) => {
                  const views = variant.total_views ?? 0
                  const submissions = variant.total_submissions ?? 0
                  const conversion = views > 0 ? (submissions / views) * 100 : 0
                  const conversionWidth = Math.max(2, (conversion / maxConversion) * 100)
                  const trafficShare = totalViews > 0 ? (views / totalViews) * 100 : 0

                  return (
                    <div key={`${variant.id}-chart`} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-medium text-gray-700">{variant.name}</span>
                        <span className="text-gray-500">
                          Conv. {conversion.toFixed(1)}% | Trafego {trafficShare.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100">
                        <div
                          className="h-2 rounded-full bg-gray-1000"
                          style={{ width: `${conversionWidth}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
