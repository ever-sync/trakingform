'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Activity, Link2, Loader2, Pencil, Plus, Trash2, Webhook } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

type WebhookType = 'generic' | 'n8n' | 'evolution_api' | 'google_sheets' | 'pipedrive' | 'hubspot'
type WebhookMethod = 'POST' | 'GET' | 'PUT' | 'PATCH'

interface WebhookDestinationItem {
  id: string
  name: string
  type: WebhookType | string
  method: WebhookMethod | string
  url: string
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
}

interface WebhooksManagerClientProps {
  initialDestinations: WebhookDestinationItem[]
}

const WEBHOOK_TYPE_OPTIONS: { value: WebhookType; label: string }[] = [
  { value: 'generic', label: 'Generico' },
  { value: 'n8n', label: 'n8n' },
  { value: 'evolution_api', label: 'Evolution API' },
  { value: 'google_sheets', label: 'Google Sheets' },
  { value: 'pipedrive', label: 'Pipedrive' },
  { value: 'hubspot', label: 'HubSpot' },
]

const WEBHOOK_METHOD_OPTIONS: WebhookMethod[] = ['POST', 'GET', 'PUT', 'PATCH']

function formatDate(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('pt-BR')
}

function normalizeDestination(raw: Partial<WebhookDestinationItem>): WebhookDestinationItem {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? 'Webhook'),
    type: String(raw.type ?? 'generic'),
    method: String(raw.method ?? 'POST'),
    url: String(raw.url ?? ''),
    is_active: Boolean(raw.is_active),
    created_at: raw.created_at ? String(raw.created_at) : null,
    updated_at: raw.updated_at ? String(raw.updated_at) : null,
  }
}

export function WebhooksManagerClient({ initialDestinations }: WebhooksManagerClientProps) {
  const [destinations, setDestinations] = useState<WebhookDestinationItem[]>(
    initialDestinations.map((item) => normalizeDestination(item))
  )
  const [editing, setEditing] = useState<WebhookDestinationItem | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const activeCount = useMemo(
    () => destinations.filter((item) => !!item.is_active).length,
    [destinations]
  )

  function startEdit(destination: WebhookDestinationItem) {
    setEditing({ ...destination })
  }

  async function saveEdit() {
    if (!editing) return

    if (!editing.name.trim() || !editing.url.trim()) {
      toast.error('Preencha nome e URL.')
      return
    }

    setSavingId(editing.id)
    try {
      const res = await fetch(`/api/webhooks/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editing.name.trim(),
          url: editing.url.trim(),
          type: editing.type,
          method: editing.method,
          is_active: !!editing.is_active,
        }),
      })

      const payload = (await res.json()) as Partial<WebhookDestinationItem> & { error?: string }
      if (!res.ok) throw new Error(payload.error || 'Falha ao salvar webhook')

      const updated = normalizeDestination(payload)
      setDestinations((prev) =>
        prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
      )
      toast.success('Webhook atualizado.')
      setEditing(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao editar webhook.'
      toast.error(message)
    } finally {
      setSavingId(null)
    }
  }

  async function removeWebhook(webhookId: string) {
    setDeletingId(webhookId)
    try {
      const res = await fetch(`/api/webhooks/${webhookId}`, { method: 'DELETE' })
      const payload = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(payload.error || 'Falha ao apagar webhook')

      setDestinations((prev) => prev.filter((item) => item.id !== webhookId))
      toast.success('Webhook apagado.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao apagar webhook.'
      toast.error(message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Total de destinos</p>
            <p className="mt-1 text-2xl font-semibold">{destinations.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Ativos</p>
            <p className="mt-1 text-2xl font-semibold">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Inativos</p>
            <p className="mt-1 text-2xl font-semibold">{destinations.length - activeCount}</p>
          </CardContent>
        </Card>
      </div>

      {destinations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
              <Webhook className="h-6 w-6 text-black" />
            </div>
            <h3 className="mb-1 font-semibold text-gray-900">Nenhum webhook configurado</h3>
            <p className="mb-4 max-w-sm text-center text-sm text-muted-foreground">
              Configure destinos para enviar leads automaticamente para n8n, WhatsApp, CRMs e mais.
            </p>
            <Button asChild className="bg-black hover:bg-gray-800">
              <Link href="/webhooks/new">
                <Plus className="mr-2 h-4 w-4" />
                Criar destino
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {destinations.map((destination) => {
            const isSavingThis = savingId === destination.id
            const isDeletingThis = deletingId === destination.id

            return (
              <Card key={destination.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="truncate pr-3">{destination.name}</span>
                    <Badge
                      variant="secondary"
                      className={destination.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}
                    >
                      {destination.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="outline">{destination.type}</Badge>
                    <Badge variant="outline">{destination.method}</Badge>
                  </div>

                  <div className="rounded-md border border-gray-100 bg-gray-50 p-2 text-xs text-gray-700">
                    <p className="mb-1 flex items-center gap-1 font-medium text-gray-600">
                      <Link2 className="h-3.5 w-3.5" />
                      URL
                    </p>
                    <p className="break-all">{destination.url}</p>
                  </div>

                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Activity className="h-3.5 w-3.5" />
                    Criado em {formatDate(destination.created_at)}
                  </p>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => startEdit(destination)}
                      disabled={isSavingThis || isDeletingThis}
                    >
                      {isSavingThis ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Pencil className="mr-1.5 h-3.5 w-3.5" />}
                      Editar
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 border-red-200 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                          disabled={isSavingThis || isDeletingThis}
                        >
                          {isDeletingThis ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
                          Apagar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent size="sm">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Apagar webhook?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Essa acao nao pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            variant="destructive"
                            onClick={() => void removeWebhook(destination.id)}
                          >
                            Apagar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => (!open ? setEditing(null) : null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar webhook</DialogTitle>
            <DialogDescription>Atualize os dados do destino e salve.</DialogDescription>
          </DialogHeader>

          {editing ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input
                  value={editing.name}
                  onChange={(event) => setEditing((prev) => (prev ? { ...prev, name: event.target.value } : prev))}
                  placeholder="Ex: n8n - Notificacao"
                />
              </div>

              <div className="space-y-1.5">
                <Label>URL</Label>
                <Input
                  value={editing.url}
                  onChange={(event) => setEditing((prev) => (prev ? { ...prev, url: event.target.value } : prev))}
                  placeholder="https://..."
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select
                    value={editing.type}
                    onValueChange={(value) => setEditing((prev) => (prev ? { ...prev, type: value } : prev))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {WEBHOOK_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Metodo</Label>
                  <Select
                    value={editing.method}
                    onValueChange={(value) => setEditing((prev) => (prev ? { ...prev, method: value } : prev))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Metodo" />
                    </SelectTrigger>
                    <SelectContent>
                      {WEBHOOK_METHOD_OPTIONS.map((method) => (
                        <SelectItem key={method} value={method}>
                          {method}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border border-gray-200 p-3">
                <div>
                  <p className="text-sm font-medium">Webhook ativo</p>
                  <p className="text-xs text-muted-foreground">Se desativado, nao dispara no envio de lead.</p>
                </div>
                <Switch
                  checked={!!editing.is_active}
                  onCheckedChange={(checked) => setEditing((prev) => (prev ? { ...prev, is_active: checked } : prev))}
                />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={!!savingId}>
              Cancelar
            </Button>
            <Button onClick={() => void saveEdit()} disabled={!editing || !!savingId} className="bg-black hover:bg-gray-800">
              {savingId ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Salvar alteracoes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
