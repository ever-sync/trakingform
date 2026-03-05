'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Download,
  ExternalLink,
  Filter,
  LayoutGrid,
  Loader2,
  Search,
  SlidersHorizontal,
  TableProperties,
  Users,
  X,
} from 'lucide-react'
import { LeadDetailDrawer } from './LeadDetailDrawer'

interface LeadItem {
  id: string
  name: string
  email: string
  phone: string
  status: string
  score: number
  is_duplicate: boolean
  form_name: string
  utm_source: string | null
  created_at_iso: string | null
  created_at_label: string
}

interface LeadsPayload {
  items: LeadItem[]
  meta: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
  summary: {
    totalLeads: number
    newToday: number
    avgScore: number
    duplicateRate: number
  }
  topSources: { source: string; count: number }[]
  filterOptions: {
    forms: { id: string; name: string }[]
    utmSources: string[]
  }
}

type SortBy = 'created_at' | 'score' | 'name'
type SortDir = 'asc' | 'desc'

type FiltersState = {
  q: string
  status: string
  dateFrom: string
  dateTo: string
  formId: string
  utmSource: string
  scoreMin: number
  scoreMax: number
  duplicate: 'all' | 'yes' | 'no'
  sortBy: SortBy
  sortDir: SortDir
  page: number
  pageSize: 10 | 25 | 50 | 100
}

const PRESET_KEY = 'leadform.leads.filters.v1'

const DEFAULT_FILTERS: FiltersState = {
  q: '',
  status: 'all',
  dateFrom: '',
  dateTo: '',
  formId: '',
  utmSource: '',
  scoreMin: 0,
  scoreMax: 100,
  duplicate: 'all',
  sortBy: 'created_at',
  sortDir: 'desc',
  page: 1,
  pageSize: 25,
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos os status' },
  { value: 'new', label: 'Novo' },
  { value: 'contacted', label: 'Contactado' },
  { value: 'qualified', label: 'Qualificado' },
  { value: 'converted', label: 'Convertido' },
  { value: 'lost', label: 'Perdido' },
] as const

const DUPLICATE_LABEL: Record<FiltersState['duplicate'], string> = {
  all: 'Todos',
  yes: 'Apenas duplicados',
  no: 'Sem duplicados',
}

function getScoreColor(score: number) {
  if (score >= 70) return 'bg-green-100 text-green-700 border-green-200'
  if (score >= 40) return 'bg-yellow-100 text-yellow-700 border-yellow-200'
  return 'bg-gray-100 text-gray-700 border-gray-200'
}

function buildQueryParams(filters: FiltersState, format: 'json' | 'csv' = 'json') {
  const params = new URLSearchParams()

  if (filters.q) params.set('q', filters.q)
  if (filters.status !== 'all') params.set('status', filters.status)
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  if (filters.formId) params.set('formId', filters.formId)
  if (filters.utmSource) params.set('utmSource', filters.utmSource)
  if (filters.scoreMin > 0) params.set('scoreMin', String(filters.scoreMin))
  if (filters.scoreMax < 100) params.set('scoreMax', String(filters.scoreMax))
  if (filters.duplicate !== 'all') params.set('duplicate', filters.duplicate)
  params.set('sortBy', filters.sortBy)
  params.set('sortDir', filters.sortDir)
  params.set('page', String(filters.page))
  params.set('pageSize', String(filters.pageSize))
  params.set('format', format)

  return params
}

interface SearchableOption {
  value: string
  label: string
}

interface SearchableSelectProps {
  value: string
  onChange: (value: string) => void
  options: SearchableOption[]
  placeholder: string
  allLabel: string
}

function SearchableSelect({ value, onChange, options, placeholder, allLabel }: SearchableSelectProps) {
  const [open, setOpen] = useState(false)

  const selected = options.find((opt) => opt.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <span className="truncate">{selected?.label ?? (value ? value : allLabel)}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                key="__all"
                value={allLabel}
                onSelect={() => {
                  onChange('')
                  setOpen(false)
                }}
              >
                <Check className={cn('mr-2 h-4 w-4', value === '' ? 'opacity-100' : 'opacity-0')} />
                {allLabel}
              </CommandItem>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === option.value ? 'opacity-100' : 'opacity-0')} />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function LeadsClientWrapper() {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [draftFilters, setDraftFilters] = useState<FiltersState>(DEFAULT_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<FiltersState>(DEFAULT_FILTERS)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [data, setData] = useState<LeadsPayload | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRESET_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<FiltersState>
      const next: FiltersState = {
        ...DEFAULT_FILTERS,
        ...parsed,
        page: 1,
      }
      setDraftFilters(next)
      setAppliedFilters(next)
    } catch {
      // ignore invalid preset
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setAppliedFilters((prev) => ({ ...prev, q: draftFilters.q, page: 1 }))
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [draftFilters.q])

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setLoadError(null)
      try {
        const params = buildQueryParams(appliedFilters, 'json')
        const response = await fetch(`/api/leads?${params.toString()}`, {
          method: 'GET',
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('Falha ao carregar leads')
        }

        const payload = (await response.json()) as LeadsPayload
        setData(payload)
      } catch (error) {
        if ((error as Error).name === 'AbortError') return
        console.error(error)
        setLoadError('Nao foi possivel carregar os leads.')
        toast.error('Nao foi possivel carregar os leads.')
      } finally {
        setLoading(false)
      }
    }

    void load()

    return () => controller.abort()
  }, [appliedFilters])

  const totalPages = data?.meta.totalPages ?? 1

  const formOptions = useMemo(
    () => (data?.filterOptions.forms ?? []).map((form) => ({ value: form.id, label: form.name })),
    [data?.filterOptions.forms]
  )

  const utmOptions = useMemo(
    () => (data?.filterOptions.utmSources ?? []).map((source) => ({ value: source, label: source })),
    [data?.filterOptions.utmSources]
  )

  const activeFilters = useMemo(() => {
    const items: { key: string; label: string; clear: () => void }[] = []
    const statusLabel = STATUS_OPTIONS.find((status) => status.value === appliedFilters.status)?.label
    const formLabel = formOptions.find((option) => option.value === appliedFilters.formId)?.label

    if (appliedFilters.q) {
      items.push({
        key: 'q',
        label: `Busca: ${appliedFilters.q}`,
        clear: () => {
          setDraftFilters((prev) => ({ ...prev, q: '', page: 1 }))
          setAppliedFilters((prev) => ({ ...prev, q: '', page: 1 }))
        },
      })
    }

    if (appliedFilters.status !== 'all' && statusLabel) {
      items.push({
        key: 'status',
        label: `Status: ${statusLabel}`,
        clear: () => {
          setDraftFilters((prev) => ({ ...prev, status: 'all', page: 1 }))
          setAppliedFilters((prev) => ({ ...prev, status: 'all', page: 1 }))
        },
      })
    }

    if (appliedFilters.dateFrom || appliedFilters.dateTo) {
      items.push({
        key: 'period',
        label: `Periodo: ${appliedFilters.dateFrom || '...'} ate ${appliedFilters.dateTo || '...'}`,
        clear: () => {
          setDraftFilters((prev) => ({ ...prev, dateFrom: '', dateTo: '', page: 1 }))
          setAppliedFilters((prev) => ({ ...prev, dateFrom: '', dateTo: '', page: 1 }))
        },
      })
    }

    if (appliedFilters.formId && formLabel) {
      items.push({
        key: 'formId',
        label: `Formulario: ${formLabel}`,
        clear: () => {
          setDraftFilters((prev) => ({ ...prev, formId: '', page: 1 }))
          setAppliedFilters((prev) => ({ ...prev, formId: '', page: 1 }))
        },
      })
    }

    if (appliedFilters.utmSource) {
      items.push({
        key: 'utm',
        label: `UTM: ${appliedFilters.utmSource}`,
        clear: () => {
          setDraftFilters((prev) => ({ ...prev, utmSource: '', page: 1 }))
          setAppliedFilters((prev) => ({ ...prev, utmSource: '', page: 1 }))
        },
      })
    }

    if (appliedFilters.duplicate !== 'all') {
      items.push({
        key: 'duplicate',
        label: DUPLICATE_LABEL[appliedFilters.duplicate],
        clear: () => {
          setDraftFilters((prev) => ({ ...prev, duplicate: 'all', page: 1 }))
          setAppliedFilters((prev) => ({ ...prev, duplicate: 'all', page: 1 }))
        },
      })
    }

    if (appliedFilters.scoreMin > 0 || appliedFilters.scoreMax < 100) {
      items.push({
        key: 'score',
        label: `Score: ${appliedFilters.scoreMin}-${appliedFilters.scoreMax}`,
        clear: () => {
          setDraftFilters((prev) => ({ ...prev, scoreMin: 0, scoreMax: 100, page: 1 }))
          setAppliedFilters((prev) => ({ ...prev, scoreMin: 0, scoreMax: 100, page: 1 }))
        },
      })
    }

    return items
  }, [
    appliedFilters.dateFrom,
    appliedFilters.dateTo,
    appliedFilters.duplicate,
    appliedFilters.formId,
    appliedFilters.q,
    appliedFilters.scoreMax,
    appliedFilters.scoreMin,
    appliedFilters.status,
    appliedFilters.utmSource,
    formOptions,
  ])

  function renderSortIcon(column: SortBy) {
    if (appliedFilters.sortBy !== column) return <ArrowDown className="h-3.5 w-3.5 opacity-30" />
    return appliedFilters.sortDir === 'asc'
      ? <ArrowUp className="h-3.5 w-3.5 text-gray-800" />
      : <ArrowDown className="h-3.5 w-3.5 text-gray-800" />
  }

  function retryLoad() {
    setAppliedFilters((prev) => ({ ...prev }))
  }

  function applyFilters() {
    setAppliedFilters((prev) => ({
      ...prev,
      ...draftFilters,
      page: 1,
    }))
    setShowMobileFilters(false)
  }

  function clearFilters() {
    setDraftFilters(DEFAULT_FILTERS)
    setAppliedFilters(DEFAULT_FILTERS)
  }

  function savePreset() {
    localStorage.setItem(PRESET_KEY, JSON.stringify(draftFilters))
    toast.success('Preset de filtros salvo.')
  }

  function loadPreset() {
    try {
      const raw = localStorage.getItem(PRESET_KEY)
      if (!raw) {
        toast.error('Nenhum preset salvo.')
        return
      }
      const parsed = JSON.parse(raw) as Partial<FiltersState>
      const next: FiltersState = { ...DEFAULT_FILTERS, ...parsed, page: 1 }
      setDraftFilters(next)
      setAppliedFilters(next)
      toast.success('Preset aplicado.')
    } catch {
      toast.error('Preset invalido.')
    }
  }

  function handleSort(nextSortBy: SortBy) {
    setAppliedFilters((prev) => {
      const nextSortDir: SortDir = prev.sortBy === nextSortBy && prev.sortDir === 'desc' ? 'asc' : 'desc'
      const next = {
        ...prev,
        sortBy: nextSortBy,
        sortDir: nextSortDir,
        page: 1,
      }
      setDraftFilters((draft) => ({ ...draft, sortBy: next.sortBy, sortDir: next.sortDir, page: 1 }))
      return next
    })
  }

  function goToPage(page: number) {
    const safePage = Math.max(1, Math.min(totalPages, page))
    setAppliedFilters((prev) => ({ ...prev, page: safePage }))
    setDraftFilters((prev) => ({ ...prev, page: safePage }))
  }

  async function exportCsv() {
    if (!data || data.meta.total === 0) return

    setExporting(true)
    try {
      const params = buildQueryParams({ ...appliedFilters, page: 1 }, 'csv')
      const response = await fetch(`/api/leads?${params.toString()}`)
      if (!response.ok) throw new Error('Falha ao exportar CSV')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
      anchor.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error(error)
      toast.error('Nao foi possivel exportar o CSV.')
    } finally {
      setExporting(false)
    }
  }

  const topMax = Math.max(...(data?.topSources.map((source) => source.count) ?? [0]))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-gray-900">Explorer de Leads</h2>
          <p className="text-sm text-muted-foreground">
            Visual elegante com filtros avancados, insights de origem e detalhes por lead.
          </p>
        </div>

        <Button
          onClick={() => void exportCsv()}
          variant="outline"
          disabled={!data || data.meta.total === 0 || exporting}
        >
          {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Exportar CSV
        </Button>
      </div>

      {loadError ? (
        <Card className="border-red-200">
          <CardContent className="flex flex-wrap items-center justify-between gap-2 py-4">
            <p className="text-sm text-red-700">{loadError}</p>
            <Button variant="outline" size="sm" onClick={retryLoad}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-gray-200/80">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Total de leads</p>
            {loading ? <Skeleton className="mt-1 h-8 w-20" /> : <p className="mt-1 text-2xl font-semibold text-gray-900">{data?.summary.totalLeads ?? 0}</p>}
          </CardContent>
        </Card>
        <Card className="border-gray-200/80">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Novos hoje</p>
            {loading ? <Skeleton className="mt-1 h-8 w-20" /> : <p className="mt-1 text-2xl font-semibold text-gray-900">{data?.summary.newToday ?? 0}</p>}
          </CardContent>
        </Card>
        <Card className="border-gray-200/80">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Score medio</p>
            {loading ? <Skeleton className="mt-1 h-8 w-20" /> : <p className="mt-1 text-2xl font-semibold text-gray-900">{(data?.summary.avgScore ?? 0).toFixed(1)}</p>}
          </CardContent>
        </Card>
        <Card className="border-gray-200/80">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Taxa de duplicados</p>
            {loading ? (
              <Skeleton className="mt-1 h-8 w-20" />
            ) : (
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {((data?.summary.duplicateRate ?? 0) * 100).toFixed(1)}%
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-gray-200/80">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ExternalLink className="h-4 w-4" />
            Top Fontes UTM
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3 w-36" />
                    <Skeleton className="h-3 w-8" />
                  </div>
                  <Skeleton className="h-2 w-full" />
                </div>
              ))}
            </div>
          ) : !data || data.topSources.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem fontes UTM para os filtros atuais.</p>
          ) : (
            <div className="space-y-2">
              {data.topSources.map((source) => {
                const percentage = topMax > 0 ? (source.count / topMax) * 100 : 0
                return (
                  <div key={source.source} className="space-y-1">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="truncate font-medium text-gray-800">{source.source}</span>
                      <span className="text-muted-foreground">{source.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100">
                      <div className="h-2 rounded-full bg-gray-1000" style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-gray-200/80">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" />
              Filtros Avancados
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="md:hidden"
              onClick={() => setShowMobileFilters((prev) => !prev)}
            >
              {showMobileFilters ? <X className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
              {showMobileFilters ? 'Fechar' : 'Abrir'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className={cn('space-y-4', !showMobileFilters && 'hidden md:block')}>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome, e-mail ou telefone..."
              value={draftFilters.q}
              onChange={(event) => setDraftFilters((prev) => ({ ...prev, q: event.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Select
              value={draftFilters.status}
              onValueChange={(value) => setDraftFilters((prev) => ({ ...prev, status: value, page: 1 }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <SearchableSelect
              value={draftFilters.formId}
              onChange={(value) => setDraftFilters((prev) => ({ ...prev, formId: value, page: 1 }))}
              options={formOptions}
              placeholder="Buscar formulario..."
              allLabel="Todos os formularios"
            />

            <SearchableSelect
              value={draftFilters.utmSource}
              onChange={(value) => setDraftFilters((prev) => ({ ...prev, utmSource: value, page: 1 }))}
              options={utmOptions}
              placeholder="Buscar origem UTM..."
              allLabel="Todas as fontes UTM"
            />

            <Select
              value={draftFilters.duplicate}
              onValueChange={(value: 'all' | 'yes' | 'no') =>
                setDraftFilters((prev) => ({ ...prev, duplicate: value, page: 1 }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Duplicados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="yes">Apenas duplicados</SelectItem>
                <SelectItem value="no">Sem duplicados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="dateFrom" className="text-xs font-medium text-muted-foreground">Data inicial</label>
              <Input
                id="dateFrom"
                type="date"
                value={draftFilters.dateFrom}
                onChange={(event) => setDraftFilters((prev) => ({ ...prev, dateFrom: event.target.value, page: 1 }))}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="dateTo" className="text-xs font-medium text-muted-foreground">Data final</label>
              <Input
                id="dateTo"
                type="date"
                value={draftFilters.dateTo}
                onChange={(event) => setDraftFilters((prev) => ({ ...prev, dateTo: event.target.value, page: 1 }))}
              />
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-gray-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="inline-flex items-center gap-2 text-sm font-medium text-gray-800">
                <SlidersHorizontal className="h-4 w-4" />
                Faixa de score
              </p>
              <span className="text-xs text-muted-foreground">
                {draftFilters.scoreMin} - {draftFilters.scoreMax}
              </span>
            </div>
            <Slider
              value={[draftFilters.scoreMin, draftFilters.scoreMax]}
              min={0}
              max={100}
              step={1}
              onValueChange={(values) => {
                const [min, max] = values
                setDraftFilters((prev) => ({ ...prev, scoreMin: min, scoreMax: max, page: 1 }))
              }}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                min={0}
                max={100}
                value={draftFilters.scoreMin}
                onChange={(event) => {
                  const next = Number.parseInt(event.target.value || '0', 10)
                  const value = Number.isFinite(next) ? Math.max(0, Math.min(100, next)) : 0
                  setDraftFilters((prev) => ({ ...prev, scoreMin: Math.min(value, prev.scoreMax), page: 1 }))
                }}
              />
              <Input
                type="number"
                min={0}
                max={100}
                value={draftFilters.scoreMax}
                onChange={(event) => {
                  const next = Number.parseInt(event.target.value || '100', 10)
                  const value = Number.isFinite(next) ? Math.max(0, Math.min(100, next)) : 100
                  setDraftFilters((prev) => ({ ...prev, scoreMax: Math.max(value, prev.scoreMin), page: 1 }))
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={applyFilters}>Aplicar filtros</Button>
            <Button variant="outline" onClick={clearFilters}>Limpar</Button>
            <Button variant="outline" onClick={savePreset}>Salvar preset</Button>
            <Button variant="outline" onClick={loadPreset}>Usar preset</Button>
          </div>

          {activeFilters.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {activeFilters.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.clear}
                  className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-100"
                >
                  {item.label} x
                </button>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'cards' | 'table')}>
        <div className="flex items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="cards">
              <LayoutGrid className="h-4 w-4" />
              Cards
            </TabsTrigger>
            <TabsTrigger value="table">
              <TableProperties className="h-4 w-4" />
              Tabela
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-4 w-4" />
            {data?.meta.total ?? 0} resultados
          </div>
        </div>

        <TabsContent value="cards" className="mt-0">
          {loading ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Card key={index}>
                  <CardContent className="space-y-3 pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-48" />
                        <Skeleton className="h-3 w-36" />
                      </div>
                      <div className="space-y-2">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Skeleton className="h-6 w-16 rounded-full" />
                      <Skeleton className="h-6 w-20 rounded-full" />
                      <Skeleton className="h-6 w-24 rounded-full" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !data || data.items.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Nenhum lead encontrado com os filtros atuais.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {data.items.map((lead) => (
                <Card
                  key={lead.id}
                  className="cursor-pointer border-gray-200/80 transition-all hover:-translate-y-0.5 hover:shadow-md"
                  onClick={() => setSelectedLeadId(lead.id)}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <h3 className="truncate font-semibold text-gray-900">{lead.name}</h3>
                        <p className="truncate text-sm text-muted-foreground">{lead.email}</p>
                        <p className="truncate text-sm text-muted-foreground">{lead.phone}</p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>{lead.created_at_label}</p>
                        <p className="truncate">{lead.form_name}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{lead.status}</Badge>
                      <Badge className={cn('border', getScoreColor(lead.score))}>Score {lead.score}</Badge>
                      {lead.is_duplicate ? <Badge variant="outline">Duplicado</Badge> : null}
                      {lead.utm_source ? (
                        <Badge variant="outline" className="inline-flex max-w-full items-center gap-1">
                          <ExternalLink className="h-3 w-3" />
                          <span className="truncate">{lead.utm_source}</span>
                        </Badge>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="table" className="mt-0">
          {loading ? (
            <Card>
              <CardContent className="space-y-2 pt-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton key={index} className="h-10 w-full" />
                ))}
              </CardContent>
            </Card>
          ) : !data || data.items.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Nenhum lead encontrado com os filtros atuais.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('name')}>
                          Nome {renderSortIcon('name')}
                        </button>
                      </TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>
                        <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('score')}>
                          Score {renderSortIcon('score')}
                        </button>
                      </TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Formulario</TableHead>
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1"
                          onClick={() => handleSort('created_at')}
                        >
                          Data {renderSortIcon('created_at')}
                        </button>
                      </TableHead>
                      <TableHead>Duplicado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((lead) => (
                      <TableRow
                        key={lead.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedLeadId(lead.id)}
                      >
                        <TableCell className="font-medium text-gray-900">{lead.name}</TableCell>
                        <TableCell>{lead.email}</TableCell>
                        <TableCell>{lead.phone}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{lead.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn('border', getScoreColor(lead.score))}>{lead.score}</Badge>
                        </TableCell>
                        <TableCell>{lead.utm_source ?? '-'}</TableCell>
                        <TableCell>{lead.form_name}</TableCell>
                        <TableCell>{lead.created_at_label}</TableCell>
                        <TableCell>{lead.is_duplicate ? 'Sim' : 'Nao'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Card className="border-gray-200/80">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="text-sm text-muted-foreground">
            Pagina {data?.meta.page ?? 1} de {totalPages} ({data?.meta.total ?? 0} registros)
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={String(appliedFilters.pageSize)}
              onValueChange={(value) => {
                const nextPageSize = Number.parseInt(value, 10) as 10 | 25 | 50 | 100
                setDraftFilters((prev) => ({ ...prev, pageSize: nextPageSize, page: 1 }))
                setAppliedFilters((prev) => ({ ...prev, pageSize: nextPageSize, page: 1 }))
              }}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 / pag</SelectItem>
                <SelectItem value="25">25 / pag</SelectItem>
                <SelectItem value="50">50 / pag</SelectItem>
                <SelectItem value="100">100 / pag</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={() => goToPage((data?.meta.page ?? 1) - 1)} disabled={(data?.meta.page ?? 1) <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => goToPage((data?.meta.page ?? 1) + 1)} disabled={(data?.meta.page ?? 1) >= totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="hidden items-center gap-1 md:flex">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => {
                const currentPage = data?.meta.page ?? 1
                const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4))
                const page = start + index
                if (page > totalPages) return null

                return (
                  <Button
                    key={page}
                    variant={page === currentPage ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => goToPage(page)}
                    className="h-8 w-8 px-0"
                  >
                    {page}
                  </Button>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <LeadDetailDrawer leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} />
    </div>
  )
}
