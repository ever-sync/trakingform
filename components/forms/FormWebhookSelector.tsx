'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronsUpDown, Loader2, Plus, Webhook } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'

interface FormWebhookSelectorProps {
  formId: string
}

interface WebhookOption {
  id: string
  name: string
  type: string | null
  method: string | null
  url: string
  is_active: boolean | null
}

interface FormWebhooksResponse {
  destinations?: WebhookOption[]
  selectedDestinationIds?: string[]
  error?: string
}

export function FormWebhookSelector({ formId }: FormWebhookSelectorProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [options, setOptions] = useState<WebhookOption[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useEffect(() => {
    let active = true

    async function loadData() {
      setLoading(true)
      try {
        const res = await fetch(`/api/forms/${formId}/webhooks`, { cache: 'no-store' })
        const payload = (await res.json()) as FormWebhooksResponse
        if (!res.ok) throw new Error(payload.error || 'Falha ao carregar webhooks')

        if (!active) return
        setOptions(Array.isArray(payload.destinations) ? payload.destinations : [])
        setSelectedIds(Array.isArray(payload.selectedDestinationIds) ? payload.selectedDestinationIds : [])
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao carregar webhooks'
        toast.error(message)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadData().catch(console.error)
    return () => {
      active = false
    }
  }, [formId])

  const selectedOptions = useMemo(() => {
    const selectedSet = new Set(selectedIds)
    return options.filter((option) => selectedSet.has(option.id))
  }, [options, selectedIds])

  function toggleWebhook(webhookId: string) {
    setSelectedIds((prev) =>
      prev.includes(webhookId)
        ? prev.filter((id) => id !== webhookId)
        : [...prev, webhookId]
    )
  }

  async function saveSelection() {
    setSaving(true)
    try {
      const res = await fetch(`/api/forms/${formId}/webhooks`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedDestinationIds: selectedIds }),
      })
      const payload = (await res.json()) as { selectedDestinationIds?: string[]; error?: string }
      if (!res.ok) throw new Error(payload.error || 'Falha ao salvar webhooks')

      setSelectedIds(Array.isArray(payload.selectedDestinationIds) ? payload.selectedDestinationIds : [])
      toast.success('Webhooks vinculados ao formulario.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao salvar webhooks'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-gray-900">Webhooks do formulario</p>
          <p className="text-xs text-muted-foreground">
            Selecione quais webhooks criados devem disparar neste formulario.
          </p>
        </div>
        <Button size="sm" variant="outline" asChild className="h-8 text-xs">
          <Link href="/webhooks/new">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Novo webhook
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-md border border-gray-100 bg-gray-50 px-3 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando webhooks...
        </div>
      ) : options.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-sm text-muted-foreground">
          Nenhum webhook criado ainda.
        </div>
      ) : (
        <>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="w-full justify-between">
                <span className="truncate text-left text-sm">
                  {selectedIds.length > 0
                    ? `${selectedIds.length} webhook(s) selecionado(s)`
                    : 'Selecionar webhooks'}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[420px] max-w-[calc(100vw-2rem)] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar webhook..." />
                <CommandList>
                  <CommandEmpty>Nenhum webhook encontrado.</CommandEmpty>
                  <CommandGroup>
                    {options.map((option) => {
                      const selected = selectedIds.includes(option.id)
                      return (
                        <CommandItem
                          key={option.id}
                          value={`${option.name} ${option.url} ${option.type ?? ''}`}
                          onSelect={() => toggleWebhook(option.id)}
                          className="items-start gap-2 py-2.5"
                        >
                          <span
                            className={cn(
                              'mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded border',
                              selected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-300 bg-white'
                            )}
                          >
                            <Check className={cn('h-3 w-3', selected ? 'opacity-100' : 'opacity-0')} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{option.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{option.url}</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              <Badge variant="outline" className="text-[10px]">
                                {option.type ?? 'generic'}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-[10px]',
                                  option.is_active ? 'border-green-300 text-green-700' : 'border-gray-300 text-gray-500'
                                )}
                              >
                                {option.is_active ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </div>
                          </div>
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <div className="flex flex-wrap gap-1.5">
            {selectedOptions.length > 0 ? (
              selectedOptions.map((option) => (
                <Badge key={option.id} variant="secondary" className="flex items-center gap-1 bg-indigo-50 text-indigo-700">
                  <Webhook className="h-3 w-3" />
                  <span className="max-w-[220px] truncate">{option.name}</span>
                </Badge>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">Nenhum webhook selecionado.</p>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700"
              onClick={() => void saveSelection()}
              disabled={saving}
            >
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Salvar webhooks
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
