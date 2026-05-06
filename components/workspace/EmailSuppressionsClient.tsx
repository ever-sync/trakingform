'use client'

import { type ChangeEvent, type DragEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Download, Loader2, Plus, Search, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface SuppressionItem {
  id: string
  email: string
  reason: string | null
  source: string | null
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
}

interface SuppressionResponse {
  items: SuppressionItem[]
  meta: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}

function buildQuery(input: { q: string; status: string; page: number; pageSize: number; format?: 'json' | 'csv' }) {
  const params = new URLSearchParams()
  params.set('status', input.status)
  params.set('page', String(input.page))
  params.set('pageSize', String(input.pageSize))
  params.set('format', input.format ?? 'json')
  if (input.q.trim()) params.set('q', input.q.trim())
  return params.toString()
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function extractEmailsFromText(value: string) {
  const matches = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []
  return Array.from(new Set(matches.map((item) => normalizeEmail(item)).filter((item) => item.length > 0)))
}

export function EmailSuppressionsClient() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [parsingFile, setParsingFile] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [items, setItems] = useState<SuppressionItem[]>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState({ total: 0, page: 1, pageSize: 25, totalPages: 1 })
  const [newEmail, setNewEmail] = useState('')
  const [newReason, setNewReason] = useState('manual')
  const [importText, setImportText] = useState('')

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timeout)
  }, [search])

  async function loadList(nextPage?: number) {
    const targetPage = nextPage ?? page
    setLoading(true)
    try {
      const query = buildQuery({
        q: debouncedSearch,
        status,
        page: targetPage,
        pageSize: meta.pageSize,
        format: 'json',
      })
      const res = await fetch(`/api/email/suppressions?${query}`)
      const data = (await res.json()) as SuppressionResponse
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Falha ao carregar')

      setItems(data.items ?? [])
      setMeta(data.meta ?? { total: 0, page: 1, pageSize: 25, totalPages: 1 })
      setPage(data.meta?.page ?? targetPage)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao carregar supressoes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadList(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, status])

  async function addSuppression() {
    const email = normalizeEmail(newEmail)
    if (!isValidEmail(email)) {
      toast.error('Informe um e-mail valido')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/email/suppressions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          reason: newReason || 'manual',
          source: 'workspace_ui',
          is_active: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao adicionar')

      setNewEmail('')
      toast.success('E-mail adicionado na supressao')
      await loadList(1)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao adicionar e-mail')
    } finally {
      setSaving(false)
    }
  }

  async function exportCsv() {
    setExporting(true)
    try {
      const query = buildQuery({
        q: debouncedSearch,
        status,
        page: 1,
        pageSize: 100,
        format: 'csv',
      })
      const res = await fetch(`/api/email/suppressions?${query}`)
      if (!res.ok) throw new Error('Falha ao exportar CSV')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `email-suppressions-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      window.URL.revokeObjectURL(url)
      toast.success('CSV exportado com sucesso.')
    } catch {
      toast.error('Nao foi possivel exportar o CSV.')
    } finally {
      setExporting(false)
    }
  }

  async function importBulk() {
    if (!importText.trim()) {
      toast.error('Cole ao menos um e-mail para importar.')
      return
    }

    setImporting(true)
    try {
      const res = await fetch('/api/email/suppressions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emails: importText,
          reason: newReason || 'manual',
          source: 'workspace_ui_bulk',
          is_active: true,
        }),
      })

      const data = await res.json() as {
        error?: string
        imported?: number
        invalid?: number
      }
      if (!res.ok) throw new Error(data.error || 'Falha ao importar')

      setImportText('')
      toast.success(
        `Importação concluída: ${data.imported ?? 0} válido(s), ${data.invalid ?? 0} inválido(s).`
      )
      await loadList(1)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao importar e-mails')
    } finally {
      setImporting(false)
    }
  }

  async function importFromFile(file: File) {
    const lower = file.name.toLowerCase()
    if (!lower.endsWith('.csv') && !lower.endsWith('.txt')) {
      toast.error('Selecione um arquivo .csv ou .txt')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Limite de 2MB.')
      return
    }

    setParsingFile(true)
    try {
      const content = await file.text()
      const emails = extractEmailsFromText(content)
      if (emails.length === 0) {
        toast.error('Nenhum e-mail valido encontrado no arquivo.')
        return
      }

      setImportText(emails.join('\n'))
      toast.success(`${emails.length} e-mail(s) carregado(s) no campo de importacao.`)
    } catch {
      toast.error('Nao foi possivel ler o arquivo.')
    } finally {
      setParsingFile(false)
    }
  }

  async function onFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    await importFromFile(file)
    event.target.value = ''
  }

  async function onDropFile(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragActive(false)
    const file = event.dataTransfer.files?.[0]
    if (!file) return
    await importFromFile(file)
  }

  async function updateStatus(item: SuppressionItem, active: boolean) {
    setSaving(true)
    try {
      const res = await fetch('/api/email/suppressions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          is_active: active,
          reason: active ? item.reason || 'manual' : 'reactivated_by_workspace',
          source: 'workspace_ui',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao atualizar')

      toast.success(active ? 'Bloqueio ativado' : 'Bloqueio removido')
      await loadList()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar bloqueio')
    } finally {
      setSaving(false)
    }
  }

  const parsedPreviewCount = useMemo(() => extractEmailsFromText(importText).length, [importText])
  const canPrev = useMemo(() => page > 1, [page])
  const canNext = useMemo(() => page < meta.totalPages, [page, meta.totalPages])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Lista de supressao (marketing)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={() => void exportCsv()} disabled={exporting || loading}>
            {exporting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
            Exportar CSV
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-2 lg:grid-cols-[2fr_1fr_auto]">
          <Input
            placeholder="email@empresa.com"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
          />
          <Input
            placeholder="Motivo (ex: unsubscribe)"
            value={newReason}
            onChange={(event) => setNewReason(event.target.value)}
          />
          <Button onClick={() => void addSuppression()} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
            Adicionar
          </Button>
        </div>

        <div className="rounded-lg border p-3">
          <p className="text-sm font-medium">Importar em lote</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Cole e-mails separados por quebra de linha, virgula ou ponto e virgula.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="hidden"
            onChange={(event) => void onFileInputChange(event)}
          />
          <div className="mt-2 space-y-2">
            <div
              className={`rounded-md border border-dashed p-3 text-xs transition-colors ${
                dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/30'
              }`}
              onDragOver={(event) => {
                event.preventDefault()
                setDragActive(true)
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(event) => void onDropFile(event)}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-muted-foreground">Arraste e solte arquivo CSV/TXT aqui.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={parsingFile}
                >
                  {parsingFile ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
                  Selecionar arquivo
                </Button>
              </div>
            </div>
            <Textarea
              placeholder={'exemplo@empresa.com\ncontato@empresa.com'}
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              rows={5}
            />
            <p className="text-xs text-muted-foreground">Emails detectados no texto: {parsedPreviewCount}</p>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => void importBulk()} disabled={importing}>
                {importing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
                Importar lote
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por email, origem ou motivo"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={status}
            onChange={(event) => setStatus(event.target.value as 'all' | 'active' | 'inactive')}
          >
            <option value="all">Todos</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando supressoes...
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum item encontrado.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="rounded border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{item.email}</p>
                    <Badge variant={item.is_active ? 'destructive' : 'outline'}>
                      {item.is_active ? 'Bloqueado' : 'Liberado'}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant={item.is_active ? 'outline' : 'default'}
                    onClick={() => void updateStatus(item, !item.is_active)}
                    disabled={saving}
                  >
                    {item.is_active ? 'Remover bloqueio' : 'Ativar bloqueio'}
                  </Button>
                </div>

                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Motivo: {item.reason || '-'}</span>
                  <span>Origem: {item.source || '-'}</span>
                  <span>Atualizado: {item.updated_at ? new Date(item.updated_at).toLocaleString('pt-BR') : '-'}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
          <p className="text-muted-foreground">
            {meta.total} registro(s) | Pagina {page} de {meta.totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!canPrev || loading} onClick={() => void loadList(page - 1)}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={!canNext || loading} onClick={() => void loadList(page + 1)}>
              Proxima
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
