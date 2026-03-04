'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Users, BarChart2, TrendingUp, CalendarDays, Loader2 } from 'lucide-react'

interface FormCard {
  id: string
  name: string
  description: string | null
  is_active: boolean | null
  total_submissions: number | null
  total_views: number | null
  created_at: string | null
}

interface FormsCardsClientProps {
  initialForms: FormCard[]
}

function formatDate(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('pt-BR')
}

export function FormsCardsClient({ initialForms }: FormsCardsClientProps) {
  const [forms, setForms] = useState<FormCard[]>(initialForms)
  const [savingId, setSavingId] = useState<string | null>(null)

  const sortedForms = useMemo(() => forms, [forms])

  async function toggleFormActive(formId: string, nextActive: boolean) {
    setSavingId(formId)
    const previous = forms
    setForms((prev) => prev.map((form) => (form.id === formId ? { ...form, is_active: nextActive } : form)))

    try {
      const res = await fetch(`/api/forms/${formId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: nextActive }),
      })

      if (!res.ok) throw new Error('Falha ao atualizar status')

      toast.success(nextActive ? 'Formulario ativado' : 'Formulario desativado (embeds bloqueados)')
    } catch (error) {
      console.error(error)
      setForms(previous)
      toast.error('Nao foi possivel atualizar o status do formulario')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {sortedForms.map((form) => {
        const views = form.total_views ?? 0
        const submissions = form.total_submissions ?? 0
        const conversion = views > 0 ? ((submissions / views) * 100).toFixed(1) : '0.0'
        const isSaving = savingId === form.id
        const isActive = form.is_active ?? false

        return (
          <Card key={form.id} className="group border-gray-200 transition-all hover:-translate-y-0.5 hover:shadow-lg">
            <CardContent className="pt-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 pr-2">
                  <h3 className="truncate font-semibold text-gray-900">{form.name}</h3>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Criado em {formatDate(form.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
                  <Switch
                    checked={isActive}
                    onCheckedChange={(checked) => void toggleFormActive(form.id, checked)}
                    disabled={isSaving}
                    aria-label={isActive ? 'Desativar formulario' : 'Ativar formulario'}
                  />
                  <Badge
                    variant="secondary"
                    className={isActive ? 'shrink-0 bg-green-100 text-green-700' : 'shrink-0 bg-gray-100 text-gray-500'}
                  >
                    {isActive ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </div>

              {form.description ? (
                <p className="mb-3 text-sm text-muted-foreground">
                  {form.description.length > 96 ? `${form.description.slice(0, 96)}...` : form.description}
                </p>
              ) : null}

              <div className="mb-4 grid grid-cols-3 gap-2 rounded-lg border border-gray-100 bg-gray-50 p-2.5 text-xs">
                <div className="space-y-0.5">
                  <p className="text-muted-foreground">Leads</p>
                  <p className="font-semibold text-gray-900">{submissions}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-muted-foreground">Visitas</p>
                  <p className="font-semibold text-gray-900">{views}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-muted-foreground">Conversao</p>
                  <p className="font-semibold text-gray-900">{conversion}%</p>
                </div>
              </div>

              <div className="mb-4 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {submissions} leads
                </span>
                <span className="flex items-center gap-1">
                  <BarChart2 className="h-3.5 w-3.5" />
                  {views} visitas
                </span>
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5" />
                  {conversion}%
                </span>
              </div>

              <div className="flex gap-2">
                <Button size="sm" variant="outline" asChild className="flex-1">
                  <Link href={`/forms/${form.id}/edit`}>Editar</Link>
                </Button>
                <Button size="sm" asChild className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                  <Link href={`/forms/${form.id}`}>Detalhes</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
