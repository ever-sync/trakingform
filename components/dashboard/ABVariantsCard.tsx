'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SplitSquareVertical } from 'lucide-react'

type PeriodKey = '7d' | '30d' | 'all'

interface VariantMetric {
  id: string
  name: string
  form_id: string | null
  form_name: string
  total_views: number
  total_submissions: number
  submissions_7d: number
  submissions_30d: number
}

interface FormOption {
  id: string
  name: string
}

interface ABVariantsCardProps {
  variants: VariantMetric[]
  forms: FormOption[]
}

function getPeriodSubmissions(variant: VariantMetric, period: PeriodKey): number {
  if (period === '7d') return variant.submissions_7d
  if (period === '30d') return variant.submissions_30d
  return variant.total_submissions
}

export function ABVariantsCard({ variants, forms }: ABVariantsCardProps) {
  const [period, setPeriod] = useState<PeriodKey>('30d')
  const [formFilter, setFormFilter] = useState<string>('all')

  const filteredVariants = useMemo(() => {
    const scoped = formFilter === 'all'
      ? variants
      : variants.filter((variant) => variant.form_id === formFilter)

    return scoped
      .map((variant) => ({
        ...variant,
        period_submissions: getPeriodSubmissions(variant, period),
        conversion: variant.total_views > 0 ? (variant.total_submissions / variant.total_views) * 100 : 0,
      }))
      .sort((a, b) => {
        if (b.period_submissions !== a.period_submissions) {
          return b.period_submissions - a.period_submissions
        }
        return b.conversion - a.conversion
      })
      .slice(0, 6)
  }, [variants, period, formFilter])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-base">
          <SplitSquareVertical className="h-4 w-4" />
          Top Variantes (A/B)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value as PeriodKey)}
            className="h-8 rounded border border-gray-200 px-2 text-xs"
          >
            <option value="7d">Ultimos 7 dias</option>
            <option value="30d">Ultimos 30 dias</option>
            <option value="all">Todo periodo</option>
          </select>

          <select
            value={formFilter}
            onChange={(event) => setFormFilter(event.target.value)}
            className="h-8 rounded border border-gray-200 px-2 text-xs"
          >
            <option value="all">Todos os formularios</option>
            {forms.map((form) => (
              <option key={form.id} value={form.id}>
                {form.name}
              </option>
            ))}
          </select>
        </div>

        {filteredVariants.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma variante encontrada para os filtros selecionados.
          </div>
        ) : (
          <div className="space-y-2">
            {filteredVariants.map((variant) => (
              <div key={variant.id} className="rounded-md border px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{variant.name}</span>
                  <span className="text-xs text-muted-foreground">{variant.conversion.toFixed(1)}%</span>
                </div>
                <p className="truncate text-xs text-muted-foreground">{variant.form_name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {variant.period_submissions} leads no periodo | {variant.total_views} views totais
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
