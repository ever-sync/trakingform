'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { FormField, FormTheme, FormSettings } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { AlertCircle, Eye, Layers, Loader2, Monitor, Save, Smartphone, Upload } from 'lucide-react'
import { validateBuilderFields } from '@/lib/forms/builder-validation'
import { FieldPalette } from './FieldPalette'
import { SortableFieldItem } from './SortableFieldItem'
import { FieldEditor } from './FieldEditor'
import { AIFormDialog } from './AIFormDialog'
import { ABTestPanel } from './ABTestPanel'
import { StepBreakEditor, type StepConfig } from './StepBreakEditor'
import { FormWebhookSelector } from './FormWebhookSelector'

interface FormBuilderProps {
  formId: string
  initialName: string
  initialFields: FormField[]
  initialSettings?: unknown
  initialSubmitRedirectUrl?: string | null
  initialSubmitMessage?: string | null
  initialTheme?: unknown
  initialEmailTemplateId?: string | null
}

type BuilderVersionState = {
  draftVersion: number
  publishedVersion: number
  publishedAt: string | null
}

type BuilderThemeState = Pick<FormTheme, 'primaryColor' | 'backgroundColor' | 'textColor' | 'borderRadius'>
type AutoWinnerState = {
  enabled: boolean
  minDays: number
  minViews: number
  appliedAt: string | null
  winnerVariantId: string | null
  lastEvaluatedAt: string | null
}

const DEFAULT_LABELS: Record<FormField['type'], string> = {
  text: 'Campo de texto',
  email: 'E-mail',
  phone: 'Telefone',
  textarea: 'Mensagem',
  select: 'Selecao',
  radio: 'Multipla escolha',
  checkbox: 'Caixa de selecao',
  date: 'Data',
  hidden: 'Campo oculto',
}

const DEFAULT_PLACEHOLDERS: Partial<Record<FormField['type'], string>> = {
  text: 'Digite aqui',
  email: 'voce@exemplo.com',
  phone: '(11) 91234-5678',
  textarea: 'Digite sua mensagem',
}

const DEFAULT_THEME: BuilderThemeState = {
  primaryColor: '#4f46e5',
  backgroundColor: '#ffffff',
  textColor: '#111827',
  borderRadius: 10,
}

function parseBuilderVersionState(settings: unknown): BuilderVersionState {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return { draftVersion: 1, publishedVersion: 0, publishedAt: null }
  }

  const builder = (settings as { builder?: unknown }).builder
  if (!builder || typeof builder !== 'object' || Array.isArray(builder)) {
    return { draftVersion: 1, publishedVersion: 0, publishedAt: null }
  }

  const draftVersion = Number((builder as { draft_version?: unknown }).draft_version)
  const publishedVersion = Number((builder as { published_version?: unknown }).published_version)
  const publishedAtValue = (builder as { published_at?: unknown }).published_at

  return {
    draftVersion: Number.isFinite(draftVersion) && draftVersion > 0 ? draftVersion : 1,
    publishedVersion: Number.isFinite(publishedVersion) && publishedVersion >= 0 ? publishedVersion : 0,
    publishedAt: typeof publishedAtValue === 'string' ? publishedAtValue : null,
  }
}

function parseTheme(theme: unknown): BuilderThemeState {
  if (!theme || typeof theme !== 'object' || Array.isArray(theme)) return DEFAULT_THEME

  const t = theme as Partial<FormTheme>
  return {
    primaryColor: typeof t.primaryColor === 'string' ? t.primaryColor : DEFAULT_THEME.primaryColor,
    backgroundColor: typeof t.backgroundColor === 'string' ? t.backgroundColor : DEFAULT_THEME.backgroundColor,
    textColor: typeof t.textColor === 'string' ? t.textColor : DEFAULT_THEME.textColor,
    borderRadius: typeof t.borderRadius === 'number' ? t.borderRadius : DEFAULT_THEME.borderRadius,
  }
}

function parseMultiStepSettings(settings: unknown): { multiStep: boolean; steps: StepConfig[]; showProgressBar: boolean } {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return { multiStep: false, steps: [], showProgressBar: true }
  }

  const s = settings as Partial<FormSettings> & { stepConfig?: StepConfig[] }
  return {
    multiStep: !!s.multiStep,
    steps: Array.isArray(s.stepConfig) ? s.stepConfig : [],
    showProgressBar: s.showProgressBar !== false,
  }
}

function parseAutoWinnerSettings(settings: unknown): AutoWinnerState {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return {
      enabled: false,
      minDays: 7,
      minViews: 100,
      appliedAt: null,
      winnerVariantId: null,
      lastEvaluatedAt: null,
    }
  }

  const raw = (settings as Record<string, unknown>).abAutoWinner
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      enabled: false,
      minDays: 7,
      minViews: 100,
      appliedAt: null,
      winnerVariantId: null,
      lastEvaluatedAt: null,
    }
  }

  const cfg = raw as Record<string, unknown>
  const minDays = Number(cfg.minDays)
  const minViews = Number(cfg.minViews)

  return {
    enabled: !!cfg.enabled,
    minDays: Number.isFinite(minDays) ? Math.max(1, Math.min(365, Math.round(minDays))) : 7,
    minViews: Number.isFinite(minViews) ? Math.max(1, Math.min(1_000_000, Math.round(minViews))) : 100,
    appliedAt: typeof cfg.appliedAt === 'string' ? cfg.appliedAt : null,
    winnerVariantId: typeof cfg.winnerVariantId === 'string' ? cfg.winnerVariantId : null,
    lastEvaluatedAt: typeof cfg.lastEvaluatedAt === 'string' ? cfg.lastEvaluatedAt : null,
  }
}

function autoGenerateSteps(fields: FormField[]): StepConfig[] {
  const visibleFields = fields.filter(f => f.type !== 'hidden')
  if (visibleFields.length === 0) return [{ title: 'Etapa 1', fieldIds: [] }]

  const perStep = Math.max(2, Math.ceil(visibleFields.length / Math.ceil(visibleFields.length / 3)))
  const steps: StepConfig[] = []
  for (let i = 0; i < visibleFields.length; i += perStep) {
    steps.push({
      title: `Etapa ${steps.length + 1}`,
      fieldIds: visibleFields.slice(i, i + perStep).map(f => f.id),
    })
  }
  return steps
}

function FormPreview({
  fields,
  device,
  submitMessage,
  submitRedirectUrl,
  theme,
}: {
  fields: FormField[]
  device: 'desktop' | 'mobile'
  submitMessage: string
  submitRedirectUrl: string
  theme: BuilderThemeState
}) {
  return (
    <div className="h-full overflow-y-auto p-4">
      <div
        className="mx-auto rounded-xl border p-4 shadow-sm"
        style={{
          maxWidth: device === 'mobile' ? 420 : 760,
          backgroundColor: theme.backgroundColor,
          color: theme.textColor,
          borderRadius: `${theme.borderRadius}px`,
        }}
      >
        <h3 className="mb-1 text-base font-semibold">Preview do formulario</h3>
        <p className="mb-4 text-xs opacity-70">Visualizacao local do rascunho atual.</p>

        <div className="mb-4 grid grid-cols-1 gap-2 rounded-lg border border-gray-200 p-3 text-xs">
          <div>
            <span className="font-semibold">Mensagem de sucesso:</span> {submitMessage || 'Obrigado!'}
          </div>
          <div>
            <span className="font-semibold">Redirect:</span> {submitRedirectUrl || 'Nao configurado'}
          </div>
        </div>

        {fields.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
            Adicione campos para visualizar o formulario.
          </div>
        ) : (
          <div className="space-y-3">
            {fields.map((field) => {
              if (field.type === 'hidden') return null

              return (
                <div key={field.id} className="space-y-1.5">
                  <label className="text-sm font-medium">
                    {field.label || 'Sem rotulo'}
                    {field.required ? <span className="ml-1 text-red-500">*</span> : null}
                  </label>

                  {(field.type === 'text' || field.type === 'email' || field.type === 'phone' || field.type === 'date') && (
                    <input
                      disabled
                      type={field.type === 'phone' ? 'tel' : field.type}
                      placeholder={field.placeholder || ''}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  )}

                  {field.type === 'textarea' && (
                    <textarea
                      disabled
                      rows={3}
                      placeholder={field.placeholder || ''}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  )}

                  {field.type === 'select' && (
                    <select disabled className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                      <option>Selecione...</option>
                      {(field.options ?? []).map((option) => (
                        <option key={option.value}>{option.label}</option>
                      ))}
                    </select>
                  )}

                  {(field.type === 'checkbox' || field.type === 'radio') && (
                    <div className="space-y-1.5 rounded-md border border-gray-200 p-2.5">
                      {(field.options ?? []).map((option) => (
                        <label key={option.value} className="flex items-center gap-2 text-sm">
                          <input type={field.type} disabled />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  )}

                  {field.helpText ? <p className="text-xs opacity-70">{field.helpText}</p> : null}
                </div>
              )
            })}

            <button
              className="mt-2 w-full px-3 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: theme.primaryColor, borderRadius: `${theme.borderRadius}px` }}
              disabled
            >
              Enviar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function FormBuilder({
  formId,
  initialName,
  initialFields,
  initialSettings,
  initialSubmitRedirectUrl,
  initialSubmitMessage,
  initialTheme,
  initialEmailTemplateId,
}: FormBuilderProps) {
  const [formName, setFormName] = useState(initialName)
  const [fields, setFields] = useState<FormField[]>(initialFields)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [view, setView] = useState<'canvas' | 'preview'>('canvas')
  const [settingsTab, setSettingsTab] = useState<'general' | 'ab' | 'webhooks'>('general')
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [submitRedirectUrl, setSubmitRedirectUrl] = useState(initialSubmitRedirectUrl ?? '')
  const [submitMessage, setSubmitMessage] = useState(initialSubmitMessage ?? 'Obrigado! Recebemos suas informacoes.')
  const [theme, setTheme] = useState<BuilderThemeState>(() => parseTheme(initialTheme))
  const [emailTemplateId, setEmailTemplateId] = useState<string>(initialEmailTemplateId ?? '')
  const [emailTemplates, setEmailTemplates] = useState<Array<{ id: string; name: string }>>([])
  const [versionState, setVersionState] = useState<BuilderVersionState>(() => parseBuilderVersionState(initialSettings))
  const [multiStep, setMultiStep] = useState(() => parseMultiStepSettings(initialSettings).multiStep)
  const [showProgressBar, setShowProgressBar] = useState(() => parseMultiStepSettings(initialSettings).showProgressBar)
  const [steps, setSteps] = useState<StepConfig[]>(() => parseMultiStepSettings(initialSettings).steps)
  const [progressiveProfiling, setProgressiveProfiling] = useState(() => {
    if (!initialSettings || typeof initialSettings !== 'object' || Array.isArray(initialSettings)) return false
    return !!(initialSettings as Record<string, unknown>).progressiveProfiling
  })
  const [conversational, setConversational] = useState(() => {
    if (!initialSettings || typeof initialSettings !== 'object' || Array.isArray(initialSettings)) return false
    return !!(initialSettings as Record<string, unknown>).conversational
  })
  const [autoWinnerConfig, setAutoWinnerConfig] = useState<AutoWinnerState>(() => parseAutoWinnerSettings(initialSettings))
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const selectedField = fields.find((field) => field.id === selectedId) ?? null
  const validation = useMemo(() => validateBuilderFields(fields), [fields])
  const stepEditorFields = useMemo(
    () =>
      fields
        .filter((field) => field.type !== 'hidden')
        .map((field) => ({
          id: field.id,
          label: field.label || field.name,
          type: field.type,
        })),
    [fields]
  )
  const defaultVariantSnapshot = useMemo(() => {
    const multiStepConfig = parseMultiStepSettings(initialSettings)
    const settingsObj =
      initialSettings && typeof initialSettings === 'object' && !Array.isArray(initialSettings)
        ? (initialSettings as Record<string, unknown>)
        : {}

    return {
      fields: initialFields,
      settings: {
        multiStep: multiStepConfig.multiStep,
        showProgressBar: multiStepConfig.showProgressBar,
        stepConfig: multiStepConfig.steps,
        progressiveProfiling: !!settingsObj.progressiveProfiling,
        conversational: !!settingsObj.conversational,
      },
      theme: parseTheme(initialTheme),
    }
  }, [initialFields, initialSettings, initialTheme])
  const settingsForVariant = useMemo(
    () => ({
      multiStep,
      showProgressBar,
      stepConfig: steps,
      progressiveProfiling,
      conversational,
    }),
    [multiStep, showProgressBar, steps, progressiveProfiling, conversational]
  )

  const getMultiStepPublishError = useCallback((): string | null => {
    if (!multiStep) return null

    const visibleFields = fields.filter((field) => field.type !== 'hidden')
    if (visibleFields.length === 0) return null
    if (steps.length === 0) return 'Ative o multi-step com pelo menos 1 etapa.'

    const occurrences = new Map<string, number>()

    for (const step of steps) {
      if (!Array.isArray(step.fieldIds) || step.fieldIds.length === 0) {
        return `A etapa "${step.title || 'Sem titulo'}" esta vazia.`
      }
      for (const fieldId of step.fieldIds) {
        occurrences.set(fieldId, (occurrences.get(fieldId) ?? 0) + 1)
      }
    }

    const missing = visibleFields.filter((field) => !occurrences.has(field.id))
    if (missing.length > 0) {
      return 'Existem campos visiveis sem etapa definida.'
    }

    const duplicated = visibleFields.filter((field) => (occurrences.get(field.id) ?? 0) > 1)
    if (duplicated.length > 0) {
      return 'Existem campos repetidos em mais de uma etapa.'
    }

    return null
  }, [fields, multiStep, steps])

  const saveForm = useCallback(
    async ({ manual, publish }: { manual?: boolean; publish?: boolean } = {}) => {
      const normalizedFormName = formName.trim()
      if (!normalizedFormName) {
        if (manual || publish) {
          toast.error('Informe o titulo do formulario antes de salvar.')
        }
        return
      }

      if (publish && validation.hasErrors) {
        toast.error('Corrija os erros antes de publicar.')
        return
      }
      if (publish) {
        const multiStepError = getMultiStepPublishError()
        if (multiStepError) {
          toast.error(multiStepError)
          return
        }
      }

      setSaving(true)
      setSaveStatus('saving')

      try {
        const res = await fetch(`/api/forms/${formId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: normalizedFormName,
            fields,
            publish: !!publish,
            submit_redirect_url: submitRedirectUrl.trim() || null,
            submit_message: submitMessage.trim() || 'Obrigado!',
            email_template_id: emailTemplateId || null,
            theme,
            multiStepConfig: multiStep ? { multiStep, showProgressBar, stepConfig: steps } : { multiStep: false },
            progressiveProfiling,
            conversational,
            autoWinnerConfig,
          }),
        })

        if (!res.ok) throw new Error('Falha ao salvar')

        const updated = (await res.json()) as { settings?: unknown }
        setVersionState(parseBuilderVersionState(updated.settings))
        setDirty(false)
        setSaveStatus('saved')

        if (manual) {
          toast.success(publish ? 'Formulario publicado.' : 'Rascunho salvo.')
        }
      } catch {
        setSaveStatus('error')
        if (manual) {
          toast.error('Erro ao salvar formulario.')
        }
      } finally {
        setSaving(false)
      }
    },
    [
      fields,
      formId,
      formName,
      submitMessage,
      submitRedirectUrl,
      emailTemplateId,
      theme,
      validation.hasErrors,
      multiStep,
      showProgressBar,
      steps,
      progressiveProfiling,
      conversational,
      autoWinnerConfig,
      getMultiStepPublishError,
    ]
  )

  useEffect(() => {
    if (!dirty) return

    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      void saveForm({ manual: false, publish: false })
    }, 2000)

    return () => clearTimeout(saveTimerRef.current)
  }, [dirty, saveForm])

  useEffect(() => {
    fetch('/api/email-templates')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.templates)) {
          setEmailTemplates(data.templates.map((tpl: { id: string; name: string }) => ({
            id: tpl.id,
            name: tpl.name,
          })))
        }
      })
      .catch(() => {
        setEmailTemplates([])
      })
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function markDirty() {
    setDirty(true)
    setSaveStatus('idle')
  }

  function addField(type: FormField['type']) {
    const newField: FormField = {
      id: crypto.randomUUID(),
      type,
      name: `${type}_${Date.now()}`,
      label: DEFAULT_LABELS[type],
      required: false,
      placeholder: DEFAULT_PLACEHOLDERS[type] ?? '',
      options: ['select', 'radio', 'checkbox'].includes(type)
        ? [{ label: 'Opcao 1', value: 'opcao_1' }]
        : undefined,
    }

    setFields((prev) => [...prev, newField])
    setSelectedId(newField.id)

    if (multiStep && steps.length > 0) {
      const newSteps = [...steps]
      newSteps[newSteps.length - 1] = {
        ...newSteps[newSteps.length - 1],
        fieldIds: [...newSteps[newSteps.length - 1].fieldIds, newField.id],
      }
      setSteps(newSteps)
    }

    markDirty()
  }

  function updateField(id: string, updates: Partial<FormField>) {
    setFields((prev) => prev.map((field) => (field.id === id ? { ...field, ...updates } : field)))
    markDirty()
  }

  function removeField(id: string) {
    setFields((prev) => prev.filter((field) => field.id !== id))
    if (selectedId === id) setSelectedId(null)

    if (multiStep) {
      setSteps(prev => prev.map(s => ({
        ...s,
        fieldIds: s.fieldIds.filter(fid => fid !== id),
      })))
    }

    markDirty()
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setFields((prev) => {
      const oldIndex = prev.findIndex((field) => field.id === active.id)
      const newIndex = prev.findIndex((field) => field.id === over.id)
      return arrayMove(prev, oldIndex, newIndex)
    })
    markDirty()
  }

  function applyVariantToBuilder(variant: { fields: unknown; settings: unknown; theme: unknown; name: string }) {
    if (Array.isArray(variant.fields)) {
      setFields(variant.fields as FormField[])
      setSelectedId(null)
    }

    setTheme(parseTheme(variant.theme))

    const multiStepSettings = parseMultiStepSettings(variant.settings)
    setMultiStep(multiStepSettings.multiStep)
    setShowProgressBar(multiStepSettings.showProgressBar)
    setSteps(multiStepSettings.steps)

    const settingsObj =
      variant.settings && typeof variant.settings === 'object' && !Array.isArray(variant.settings)
        ? (variant.settings as Record<string, unknown>)
        : {}
    setProgressiveProfiling(!!settingsObj.progressiveProfiling)
    setConversational(!!settingsObj.conversational)

    markDirty()
    toast.success(`Variante \"${variant.name}\" carregada no builder`)
  }

  const selectedFieldErrors = selectedField ? validation.fieldErrors[selectedField.id] ?? [] : []

  return (
    <div className="flex h-full overflow-hidden rounded-xl border bg-white shadow-sm">
      <FieldPalette onAddField={addField} />

      <div className="flex flex-1 flex-col overflow-hidden border-x">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-gray-50/80 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Construtor</span>

            {dirty ? <Badge variant="secondary" className="h-5 text-[11px]">Rascunho nao salvo</Badge> : null}
            {saveStatus === 'saving' ? <Badge variant="secondary" className="h-5 text-[11px]">Salvando...</Badge> : null}
            {saveStatus === 'saved' && !dirty ? <Badge variant="secondary" className="h-5 text-[11px]">Salvo</Badge> : null}
            {saveStatus === 'error' ? <Badge variant="destructive" className="h-5 text-[11px]">Falha ao salvar</Badge> : null}

            {validation.hasErrors ? (
              <Badge variant="outline" className="h-5 border-amber-300 bg-amber-50 text-[11px] text-amber-800">
                <AlertCircle className="mr-1 h-3 w-3" />
                {validation.totalErrors} ajuste{validation.totalErrors > 1 ? 's' : ''}
              </Badge>
            ) : null}

            <Badge variant="outline" className="h-5 text-[11px]">Draft v{versionState.draftVersion}</Badge>
            <Badge variant="outline" className="h-5 text-[11px]">Published v{versionState.publishedVersion}</Badge>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="sm" variant={view === 'canvas' ? 'default' : 'outline'} className="h-8" onClick={() => setView('canvas')}>
              Canvas
            </Button>
            <Button size="sm" variant={view === 'preview' ? 'default' : 'outline'} className="h-8" onClick={() => setView('preview')}>
              <Eye className="mr-1.5 h-3.5 w-3.5" />
              Preview
            </Button>

            {view === 'preview' ? (
              <>
                <Button size="sm" variant={previewDevice === 'desktop' ? 'default' : 'outline'} className="h-8" onClick={() => setPreviewDevice('desktop')}>
                  <Monitor className="mr-1.5 h-3.5 w-3.5" />
                  Desktop
                </Button>
                <Button size="sm" variant={previewDevice === 'mobile' ? 'default' : 'outline'} className="h-8" onClick={() => setPreviewDevice('mobile')}>
                  <Smartphone className="mr-1.5 h-3.5 w-3.5" />
                  Mobile
                </Button>
              </>
            ) : null}

            <AIFormDialog
              onFieldsGenerated={(newFields) => {
                setFields(newFields)
                if (multiStep) setSteps(autoGenerateSteps(newFields))
                markDirty()
              }}
            />

            <Button size="sm" variant="outline" className="h-8" onClick={() => window.open(`/embed/${formId}`, '_blank')}>
              <Eye className="mr-1.5 h-3.5 w-3.5" />
              Embed
            </Button>

            <Button size="sm" variant="outline" className="h-8" onClick={() => void saveForm({ manual: true, publish: false })} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              Salvar
            </Button>

            <Button size="sm" className="h-8 bg-black hover:bg-gray-800" onClick={() => void saveForm({ manual: true, publish: true })} disabled={saving}>
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Publicar
            </Button>
          </div>
        </div>

        <div className="border-b bg-white px-4 py-3">
          <Tabs
            value={settingsTab}
            onValueChange={(value) => setSettingsTab(value as 'general' | 'ab' | 'webhooks')}
            className="w-full"
          >
            <TabsList className="grid w-full max-w-[520px] grid-cols-3">
              <TabsTrigger value="general">Configurações</TabsTrigger>
              <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
              <TabsTrigger value="ab">A/B Testing</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-3 space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-1 md:col-span-2 xl:col-span-2">
                  <Label className="text-xs">Titulo do formulario</Label>
                  <Input
                    placeholder="Ex: Captacao de leads"
                    value={formName}
                    onChange={(event) => {
                      setFormName(event.target.value)
                      markDirty()
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Redirect URL apos envio</Label>
                  <Input
                    placeholder="https://seusite.com/obrigado"
                    value={submitRedirectUrl}
                    onChange={(event) => {
                      setSubmitRedirectUrl(event.target.value)
                      markDirty()
                    }}
                  />
                </div>
                <div className="space-y-1 xl:col-span-1">
                  <Label className="text-xs">Mensagem de sucesso</Label>
                  <Input
                    placeholder="Obrigado!"
                    value={submitMessage}
                    onChange={(event) => {
                      setSubmitMessage(event.target.value)
                      markDirty()
                    }}
                  />
                </div>
                <div className="space-y-1 md:col-span-2 xl:col-span-2">
                  <Label className="text-xs">Template de e-mail (envio do formulario)</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="h-10 w-full max-w-[320px] rounded-md border bg-background px-3 text-sm"
                      value={emailTemplateId}
                      onChange={(event) => {
                        setEmailTemplateId(event.target.value)
                        markDirty()
                      }}
                    >
                      <option value="">Sem template</option>
                      {emailTemplates.map((template) => (
                        <option key={template.id} value={template.id}>{template.name}</option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => window.open('/emails/new', '_blank')}
                    >
                      Criar novo template
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cor do botao</Label>
                  <Input
                    type="color"
                    value={theme.primaryColor}
                    onChange={(event) => {
                      setTheme((prev) => ({ ...prev, primaryColor: event.target.value }))
                      markDirty()
                    }}
                    className="h-10"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Fundo</Label>
                    <Input
                      type="color"
                      value={theme.backgroundColor}
                      onChange={(event) => {
                        setTheme((prev) => ({ ...prev, backgroundColor: event.target.value }))
                        markDirty()
                      }}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Texto</Label>
                    <Input
                      type="color"
                      value={theme.textColor}
                      onChange={(event) => {
                        setTheme((prev) => ({ ...prev, textColor: event.target.value }))
                        markDirty()
                      }}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Borda</Label>
                    <Input
                      type="number"
                      min={0}
                      max={24}
                      value={theme.borderRadius}
                      onChange={(event) => {
                        const nextRadius = Number(event.target.value)
                        setTheme((prev) => ({ ...prev, borderRadius: Number.isFinite(nextRadius) ? nextRadius : 10 }))
                        markDirty()
                      }}
                      className="h-10"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 border-t border-gray-100 pt-3">
                <label className="flex cursor-pointer items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={multiStep}
                    onChange={(e) => {
                      const enabled = e.target.checked
                      setMultiStep(enabled)
                      if (enabled && steps.length === 0) {
                        setSteps(autoGenerateSteps(fields))
                      }
                      markDirty()
                    }}
                    className="rounded border-gray-300"
                  />
                  <Layers className="h-3.5 w-3.5 text-gray-500" />
                  <span className="font-medium text-gray-700">Multi-step</span>
                </label>

                <label className="flex cursor-pointer items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={progressiveProfiling}
                    onChange={(e) => {
                      setProgressiveProfiling(e.target.checked)
                      markDirty()
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="font-medium text-gray-700">Progressive Profiling</span>
                </label>

                <label className="flex cursor-pointer items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={conversational}
                    onChange={(e) => {
                      const enabled = e.target.checked
                      setConversational(enabled)
                      if (enabled && multiStep) setMultiStep(false)
                      markDirty()
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="font-medium text-gray-700">Modo Conversacional</span>
                </label>

                {multiStep ? (
                  <label className="flex cursor-pointer items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={showProgressBar}
                      onChange={(e) => {
                        setShowProgressBar(e.target.checked)
                        markDirty()
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className="text-gray-600">Barra de progresso</span>
                  </label>
                ) : null}
              </div>

              {multiStep ? (
                <StepBreakEditor
                  steps={steps}
                  fields={stepEditorFields}
                  onChange={(nextSteps) => {
                    setSteps(nextSteps)
                    markDirty()
                  }}
                  onAutoSplit={() => {
                    setSteps(autoGenerateSteps(fields))
                    markDirty()
                  }}
                />
              ) : null}
            </TabsContent>

            <TabsContent value="webhooks" className="mt-3">
              <FormWebhookSelector formId={formId} />
            </TabsContent>

            <TabsContent value="ab" className="mt-3">
              <ABTestPanel
                formId={formId}
                baseFields={fields}
                baseSettings={settingsForVariant}
                baseTheme={theme}
                defaultFields={defaultVariantSnapshot.fields}
                defaultSettings={defaultVariantSnapshot.settings}
                defaultTheme={defaultVariantSnapshot.theme}
                autoWinnerConfig={autoWinnerConfig}
                onAutoWinnerConfigChange={(nextConfig) => {
                  setAutoWinnerConfig(nextConfig)
                  markDirty()
                }}
                onLoadVariant={applyVariantToBuilder}
              />
            </TabsContent>
          </Tabs>
        </div>

        {view === 'canvas' ? (
          <div className="flex-1 overflow-y-auto p-4">
            {fields.length === 0 ? (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 px-4 text-center">
                <div className="mb-3 text-3xl">[]</div>
                <p className="text-sm font-medium text-gray-700">Canvas vazio</p>
                <p className="mt-1 text-xs text-gray-400">Clique em um tipo de campo no painel esquerdo para adicionar.</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={fields.map((field) => field.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {fields.map((field) => {
                      const stepIdx = multiStep ? steps.findIndex(s => s.fieldIds.includes(field.id)) : -1
                      const isStepStart = multiStep && stepIdx >= 0 && steps[stepIdx].fieldIds[0] === field.id

                      return (
                        <div key={field.id}>
                          {isStepStart && (
                            <div className="flex items-center gap-2 mb-2 mt-1">
                              <div className="h-px flex-1 bg-gray-200" />
                              <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                                {steps[stepIdx].title}
                              </span>
                              <div className="h-px flex-1 bg-gray-200" />
                            </div>
                          )}
                          <SortableFieldItem
                            field={field}
                            isSelected={selectedId === field.id}
                            errorCount={(validation.fieldErrors[field.id] ?? []).length}
                            onSelect={() => setSelectedId(field.id)}
                            onRemove={() => removeField(field.id)}
                          />
                        </div>
                      )
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        ) : (
          <FormPreview
            fields={fields}
            device={previewDevice}
            submitMessage={submitMessage}
            submitRedirectUrl={submitRedirectUrl}
            theme={theme}
          />
        )}

        {fields.length > 0 ? (
          <div className="border-t bg-gray-50/80 px-4 py-2 text-xs text-gray-400">
            {fields.length} campo{fields.length !== 1 ? 's' : ''}
            {versionState.publishedAt ? ` | Ultima publicacao: ${new Date(versionState.publishedAt).toLocaleString('pt-BR')}` : ''}
          </div>
        ) : null}
      </div>

      <div className="flex w-72 flex-col border-l bg-white">
        <div className="px-4 py-3">
          <p className="text-xs font-semibold text-gray-700">Campo selecionado</p>
        </div>
        <Separator />
        <div className="min-h-0 flex-1 overflow-auto">
          <FieldEditor field={selectedField} errors={selectedFieldErrors} onUpdate={(updates) => selectedId && updateField(selectedId, updates)} />
        </div>
      </div>
    </div>
  )
}
