'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useUndoRedo } from '@/hooks/useUndoRedo'
import { toast } from 'sonner'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { EmailBlock } from '@/types'
import { isValidUrl, isValidEmail } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmailBlocksPalette } from '@/components/emails/EmailBlocksPalette'
import { EmailBlockEditor } from '@/components/emails/EmailBlockEditor'
import { renderEmailBlocks } from '@/lib/services/email/render'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { GripVertical, Trash2, Copy, Monitor, Smartphone, Undo2, Redo2, Loader2 } from 'lucide-react'

type TemplateFormState = {
  name: string
  subject: string
  from_name: string
  from_email: string
  reply_to: string
}

const DEFAULT_BLOCKS: EmailBlock[] = [
  { id: 'header_1', type: 'header', backgroundColor: '#111827', logoUrl: '' },
  { id: 'text_1', type: 'text', content: 'Olá {{name}}, obrigado pelo contato!' },
  { id: 'button_1', type: 'button', label: 'Ver mais', url: 'https://', color: '#4f46e5' },
  { id: 'footer_1', type: 'footer', content: 'Equipe {{form_name}}', unsubscribeUrl: '{{unsubscribe_url}}' },
]

const DEFAULT_PREVIEW_VARS: Record<string, string> = {
  name: 'Maria',
  email: 'maria@empresa.com',
  form_name: 'Formulario de Leads',
  submit_message: 'Obrigado! Em breve entraremos em contato.',
  utm_source: 'google',
  created_at: new Date().toISOString(),
  unsubscribe_url: '#',
}

const PRESET_TEMPLATES: Array<{
  id: string
  name: string
  subject: string
  blocks: EmailBlock[]
}> = [
  {
    id: 'lead_received',
    name: 'Lead recebido',
    subject: 'Recebemos seu contato, {{name}}',
    blocks: [
      { id: 'header_1', type: 'header', backgroundColor: '#111827', logoUrl: '' },
      {
        id: 'text_1',
        type: 'text',
        content: 'Olá {{name}}, recebemos sua solicitação no formulário {{form_name}}.',
      },
      { id: 'text_2', type: 'text', content: 'Mensagem enviada: {{submit_message}}' },
      { id: 'divider_1', type: 'divider' },
      { id: 'footer_1', type: 'footer', content: 'Obrigado por confiar em {{form_name}}.', unsubscribeUrl: '{{unsubscribe_url}}' },
    ],
  },
  {
    id: 'welcome',
    name: 'Boas-vindas',
    subject: 'Bem-vindo(a), {{name}}',
    blocks: [
      { id: 'header_1', type: 'header', backgroundColor: '#0f172a', logoUrl: '' },
      { id: 'text_1', type: 'text', content: 'Olá {{name}}, seja bem-vindo(a)! Em breve entraremos em contato.' },
      { id: 'button_1', type: 'button', label: 'Visitar site', url: 'https://', color: '#4f46e5' },
      { id: 'footer_1', type: 'footer', content: 'Equipe {{form_name}}', unsubscribeUrl: '{{unsubscribe_url}}' },
    ],
  },
  {
    id: 'followup',
    name: 'Follow-up',
    subject: 'Podemos ajudar em algo mais, {{name}}?',
    blocks: [
      { id: 'header_1', type: 'header', backgroundColor: '#1f2937', logoUrl: '' },
      {
        id: 'text_1',
        type: 'text',
        content: 'Olá {{name}}, estamos à disposição para tirar dúvidas.',
      },
      { id: 'button_1', type: 'button', label: 'Falar com a equipe', url: 'https://', color: '#10b981' },
      { id: 'footer_1', type: 'footer', content: 'Equipe {{form_name}}', unsubscribeUrl: '{{unsubscribe_url}}' },
    ],
  },
]

function buildBlock(type: EmailBlock['type']): EmailBlock {
  const id = `${type}_${crypto.randomUUID()}`
  if (type === 'header') return { id, type, backgroundColor: '#111827', logoUrl: '' }
  if (type === 'text') return { id, type, content: '' }
  if (type === 'image') return { id, type, src: '', alt: '' }
  if (type === 'button') return { id, type, label: 'Clique aqui', url: 'https://', color: '#4f46e5' }
  if (type === 'footer') return { id, type, content: '', unsubscribeUrl: '{{unsubscribe_url}}' }
  return { id, type }
}


function validateBlocks(blocks: EmailBlock[]) {
  const errors: string[] = []

  if (blocks.length === 0) {
    errors.push('Adicione pelo menos 1 bloco no template.')
    return errors
  }

  blocks.forEach((block, index) => {
    const label = `${block.type} #${index + 1}`

    if (block.type === 'text' && !String(block.content ?? '').trim()) {
      errors.push(`${label}: conteudo obrigatorio.`)
    }
    if (block.type === 'button') {
      if (!String(block.label ?? '').trim()) {
        errors.push(`${label}: texto do botao obrigatorio.`)
      }
      const url = String(block.url ?? '').trim()
      if (!url) {
        errors.push(`${label}: URL do botao obrigatoria.`)
      } else if (!isValidUrl(url) && !url.includes('{{')) {
        errors.push(`${label}: URL inválida.`)
      }
    }
    if (block.type === 'image') {
      const src = String(block.src ?? '').trim()
      if (!src) {
        errors.push(`${label}: URL da imagem obrigatoria.`)
      } else if (!isValidUrl(src) && !src.includes('{{')) {
        errors.push(`${label}: URL da imagem inválida.`)
      }
    }
  })

  return errors
}

function getFormErrors(form: TemplateFormState) {
  const errors: string[] = []
  if (form.subject.trim().length < 5) {
    errors.push('Assunto precisa ter pelo menos 5 caracteres.')
  }
  if (form.from_email.trim() && !isValidEmail(form.from_email.trim())) {
    errors.push('De (e-mail) inválido.')
  }
  if (form.reply_to.trim() && !isValidEmail(form.reply_to.trim())) {
    errors.push('Reply-to inválido.')
  }
  return errors
}

export function EmailTemplateBuilder({
  initialForm,
  initialBlocks,
  saving,
  onSave,
  onCancel,
  templateId,
  onAutoSave,
}: {
  initialForm: TemplateFormState
  initialBlocks?: EmailBlock[]
  saving?: boolean
  onSave: (payload: TemplateFormState & { blocks: EmailBlock[] }) => void
  onCancel?: () => void
  templateId?: string
  onAutoSave?: (payload: TemplateFormState & { blocks: EmailBlock[] }) => Promise<void>
}) {
  const [form, setForm] = useState<TemplateFormState>(initialForm)
  const initialBlocksValue = initialBlocks?.length ? initialBlocks : DEFAULT_BLOCKS
  const { value: blocks, set: setBlocks, undo, redo, canUndo, canRedo } = useUndoRedo<EmailBlock[]>(initialBlocksValue)
  const [selectedId, setSelectedId] = useState<string | null>(initialBlocksValue[0]?.id ?? null)
  const [tab, setTab] = useState<'editor' | 'preview'>('editor')
  const [presetId, setPresetId] = useState('')
  const [previewVars, setPreviewVars] = useState<Record<string, string>>(DEFAULT_PREVIEW_VARS)
  const [blockErrors, setBlockErrors] = useState<string[]>([])
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [showPresetConfirm, setShowPresetConfirm] = useState(false)
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [dirty, setDirty] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [testEmail, setTestEmail] = useState('')
  const [sendingTest, setSendingTest] = useState(false)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  const selectedBlock = blocks.find((block) => block.id === selectedId) ?? null

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const previewHtml = useMemo(() => renderEmailBlocks(blocks, previewVars), [blocks, previewVars])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  // Auto-save (only on edit page)
  useEffect(() => {
    if (!dirty || !templateId || !onAutoSave) return

    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving')
      try {
        await onAutoSave({ ...form, blocks })
        setSaveStatus('saved')
        setDirty(false)
      } catch {
        setSaveStatus('error')
      }
    }, 2000)

    return () => clearTimeout(saveTimerRef.current)
  }, [dirty, templateId, onAutoSave, form, blocks])

  function markDirty() {
    setDirty(true)
    setSaveStatus('idle')
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null)
    const { active, over } = event
    if (!over) return

    const activeId = String(active.id)

    // Drag from palette: create new block at drop position
    if (activeId.startsWith('palette:')) {
      const blockType = active.data.current?.blockType as EmailBlock['type']
      const newBlock = buildBlock(blockType)
      const overId = String(over.id)

      if (overId === 'canvas-droppable') {
        setBlocks([...blocks, newBlock])
      } else {
        const overIndex = blocks.findIndex((b) => b.id === overId)
        const next = [...blocks]
        next.splice(overIndex >= 0 ? overIndex : blocks.length, 0, newBlock)
        setBlocks(next)
      }
      setSelectedId(newBlock.id)
      markDirty()
      return
    }

    // Reorder existing blocks
    if (active.id === over.id) return
    const oldIndex = blocks.findIndex((block) => block.id === active.id)
    const newIndex = blocks.findIndex((block) => block.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    setBlocks(arrayMove(blocks, oldIndex, newIndex))
    markDirty()
  }

  function addBlock(type: EmailBlock['type']) {
    const newBlock = buildBlock(type)
    setBlocks([...blocks, newBlock])
    setSelectedId(newBlock.id)
    markDirty()
  }

  function applyPreset() {
    const preset = PRESET_TEMPLATES.find((item) => item.id === presetId)
    if (!preset) return

    const clonedBlocks = preset.blocks.map((block) => ({
      ...block,
      id: `${block.type}_${crypto.randomUUID()}`,
    }))
    setBlocks(clonedBlocks)
    setSelectedId(clonedBlocks[0]?.id ?? null)
    setForm((prev) => ({
      ...prev,
      name: prev.name.trim() ? prev.name : preset.name,
      subject: prev.subject.trim() ? prev.subject : preset.subject,
    }))
    setBlockErrors([])
    setFormErrors([])
  }

  function handleApplyPreset() {
    if (blocks.length > 0) {
      setShowPresetConfirm(true)
    } else {
      applyPreset()
    }
  }

  async function loadLatestLeadPreview() {
    try {
      const res = await fetch('/api/leads?sortBy=created_at&sortDir=desc&page=1&pageSize=1')
      if (!res.ok) throw new Error('Falha ao carregar leads')
      const payload = (await res.json()) as {
        items?: Array<{
          name: string
          email: string
          form_name: string
          utm_source: string | null
          created_at_iso: string | null
        }>
      }

      const lead = payload.items?.[0]
      if (!lead) {
        toast.error('Nenhum lead encontrado para preview.')
        return
      }

      setPreviewVars((prev) => ({
        ...prev,
        name: lead.name || prev.name,
        email: lead.email || prev.email,
        form_name: lead.form_name || prev.form_name,
        utm_source: lead.utm_source ?? '',
        created_at: lead.created_at_iso ?? new Date().toISOString(),
      }))
      toast.success('Preview atualizado com o ultimo lead.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao carregar preview real.')
    }
  }

  function resetPreviewVars() {
    setPreviewVars(DEFAULT_PREVIEW_VARS)
  }

  function updateBlock(next: EmailBlock) {
    setBlocks(blocks.map((block) => (block.id === next.id ? next : block)))
    setBlockErrors([])
    markDirty()
  }

  function removeBlock(id: string) {
    setBlocks(blocks.filter((block) => block.id !== id))
    if (selectedId === id) {
      const remaining = blocks.filter((block) => block.id !== id)
      setSelectedId(remaining[0]?.id ?? null)
    }
    setBlockErrors([])
    markDirty()
  }

  function duplicateBlock(id: string) {
    const block = blocks.find((item) => item.id === id)
    if (!block) return
    const clone = { ...block, id: `${block.type}_${crypto.randomUUID()}` }
    const index = blocks.findIndex((item) => item.id === id)
    const next = [...blocks]
    next.splice(index + 1, 0, clone)
    setBlocks(next)
    setSelectedId(clone.id)
    setBlockErrors([])
    markDirty()
  }

  async function handleSendTest() {
    if (!templateId) return
    setSendingTest(true)
    try {
      const res = await fetch(`/api/email-templates/${templateId}/send-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: testEmail.trim() || undefined,
          variables: previewVars,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Falha ao enviar teste')
      toast.success('Email de teste enviado!')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar teste')
    } finally {
      setSendingTest(false)
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const nextFormErrors = getFormErrors(form)
    setFormErrors(nextFormErrors)
    if (nextFormErrors.length > 0) {
      toast.error(nextFormErrors[0])
      return
    }
    const errors = validateBlocks(blocks)
    setBlockErrors(errors)
    if (errors.length > 0) {
      toast.error(errors[0])
      return
    }
    onSave({ ...form, blocks })
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
    <form onSubmit={submit} className="flex h-full overflow-hidden rounded-xl border bg-white shadow-sm">
      <EmailBlocksPalette onAdd={addBlock} />

      <div className="flex flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-gray-50/80 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Template</span>
            <Badge variant="outline" className="h-5 text-[11px]">{blocks.length} bloco(s)</Badge>
            {saveStatus === 'saving' && <Badge variant="secondary" className="h-5 text-[11px]">Salvando...</Badge>}
            {saveStatus === 'saved' && !dirty && <Badge variant="secondary" className="h-5 text-[11px]">Salvo</Badge>}
            {saveStatus === 'error' && <Badge variant="destructive" className="h-5 text-[11px]">Falha ao salvar</Badge>}
            <div className="flex items-center gap-0.5">
              <Button type="button" size="icon" variant="ghost" onClick={undo} disabled={!canUndo} title="Desfazer (Ctrl+Z)">
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button type="button" size="icon" variant="ghost" onClick={redo} disabled={!canRedo} title="Refazer (Ctrl+Shift+Z)">
                <Redo2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onCancel ? (
              <Button type="button" variant="outline" size="sm" onClick={onCancel}>
                Cancelar
              </Button>
            ) : null}
            <Button type="submit" size="sm" disabled={saving}>
              Salvar template
            </Button>
          </div>
        </div>

        <div className="border-b bg-white px-4 py-3">
          {formErrors.length > 0 ? (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {formErrors.map((error) => (
                <div key={error}>{error}</div>
              ))}
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1 md:col-span-2 xl:col-span-2">
              <Label className="text-xs">Nome do template *</Label>
              <Input
                value={form.name}
                onChange={(event) => { setForm((prev) => ({ ...prev, name: event.target.value })); markDirty() }}
                placeholder="Ex: Boas-vindas ao lead"
                required
              />
            </div>
            <div className="space-y-1 md:col-span-2 xl:col-span-2">
              <Label className="text-xs">Assunto *</Label>
              <Input
                value={form.subject}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, subject: event.target.value }))
                  setFormErrors([])
                  markDirty()
                }}
                placeholder="Ex: Olá {{name}}, obrigado!"
                required
              />
              <p className="text-[11px] text-muted-foreground">Mínimo de 5 caracteres.</p>
              {form.subject.trim().length > 0 && form.subject.trim().length < 5 ? (
                <p className="text-[11px] text-red-600">Assunto muito curto.</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">De (nome)</Label>
              <Input
                value={form.from_name}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, from_name: event.target.value }))
                  setFormErrors([])
                  markDirty()
                }}
                placeholder="Equipe"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">De (email)</Label>
              <Input
                type="email"
                value={form.from_email}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, from_email: event.target.value }))
                  setFormErrors([])
                  markDirty()
                }}
                placeholder="contato@empresa.com"
              />
              {form.from_email.trim() && !isValidEmail(form.from_email.trim()) ? (
                <p className="text-[11px] text-red-600">E-mail inválido.</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Reply-to</Label>
              <Input
                type="email"
                value={form.reply_to}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, reply_to: event.target.value }))
                  setFormErrors([])
                  markDirty()
                }}
                placeholder="respostas@empresa.com"
              />
              {form.reply_to.trim() && !isValidEmail(form.reply_to.trim()) ? (
                <p className="text-[11px] text-red-600">E-mail inválido.</p>
              ) : null}
            </div>
            <div className="space-y-1 md:col-span-2 xl:col-span-2">
              <Label className="text-xs">Templates prontos</Label>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="h-10 w-full max-w-[260px] rounded-md border bg-background px-3 text-sm"
                  value={presetId}
                  onChange={(event) => setPresetId(event.target.value)}
                >
                  <option value="">Selecione um preset</option>
                  {PRESET_TEMPLATES.map((preset) => (
                    <option key={preset.id} value={preset.id}>{preset.name}</option>
                  ))}
                </select>
                <Button type="button" variant="outline" size="sm" onClick={handleApplyPreset} disabled={!presetId}>
                  Aplicar preset
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="min-h-0 flex-1 overflow-auto p-4">
            {blockErrors.length > 0 ? (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {blockErrors.map((error) => (
                  <div key={error}>{error}</div>
                ))}
              </div>
            ) : null}
            <CanvasDropZone isEmpty={blocks.length === 0}>
              <SortableContext items={blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {blocks.map((block) => (
                    <SortableBlockItem
                      key={block.id}
                      block={block}
                      selected={selectedId === block.id}
                      onSelect={() => setSelectedId(block.id)}
                      onDuplicate={() => duplicateBlock(block.id)}
                      onRemove={() => removeBlock(block.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </CanvasDropZone>
          </div>

          <div className="w-[360px] border-l bg-white p-4">
            <Tabs value={tab} onValueChange={(value) => setTab(value as 'editor' | 'preview')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="editor">Editor</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="editor" className="mt-3">
                <EmailBlockEditor block={selectedBlock} onChange={updateBlock} />
              </TabsContent>
              <TabsContent value="preview" className="mt-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={previewDevice === 'desktop' ? 'default' : 'outline'}
                      onClick={() => setPreviewDevice('desktop')}
                    >
                      <Monitor className="mr-1 h-4 w-4" /> Desktop
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={previewDevice === 'mobile' ? 'default' : 'outline'}
                      onClick={() => setPreviewDevice('mobile')}
                    >
                      <Smartphone className="mr-1 h-4 w-4" /> Mobile
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={loadLatestLeadPreview}>
                      Usar ultimo lead
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={resetPreviewVars}>
                      Resetar
                    </Button>
                  </div>
                </div>
                <div className="flex h-[520px] justify-center overflow-hidden rounded-lg border bg-gray-100">
                  <iframe
                    title="preview"
                    className="h-full bg-white"
                    style={{ width: previewDevice === 'mobile' ? 375 : 600 }}
                    srcDoc={previewHtml}
                  />
                </div>
                {templateId && (
                  <div className="mt-3 flex items-center gap-2">
                    <Input
                      type="email"
                      placeholder="E-mail de teste (padrão: seu e-mail)"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      className="flex-1"
                    />
                    <Button type="button" size="sm" disabled={sendingTest} onClick={handleSendTest}>
                      {sendingTest ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                      Enviar teste
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <AlertDialog open={showPresetConfirm} onOpenChange={setShowPresetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir blocos?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os {blocks.length} blocos existentes serão substituídos pelo preset selecionado. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { applyPreset(); setShowPresetConfirm(false) }}>
              Aplicar preset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>

      <DragOverlay>
        {activeDragId?.startsWith('palette:') ? (
          <div className="rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm font-medium text-gray-900 shadow-lg">
            {activeDragId.replace('palette:', '')}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function CanvasDropZone({ isEmpty, children }: { isEmpty: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas-droppable' })

  if (isEmpty) {
    return (
      <div
        ref={setNodeRef}
        className={`flex h-full min-h-[220px] flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 text-center transition-colors ${
          isOver ? 'border-gray-400 bg-gray-50/50' : 'border-gray-200'
        }`}
      >
        <div className="mb-2 text-3xl">[]</div>
        <p className="text-sm font-medium text-gray-700">Canvas vazio</p>
        <p className="mt-1 text-xs text-gray-400">Adicione blocos no painel esquerdo ou arraste aqui.</p>
      </div>
    )
  }

  return <div ref={setNodeRef}>{children}</div>
}

function SortableBlockItem({
  block,
  selected,
  onSelect,
  onDuplicate,
  onRemove,
}: {
  block: EmailBlock
  selected: boolean
  onSelect: () => void
  onDuplicate: () => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center justify-between rounded-lg border px-3 py-2 ${
        selected ? 'border-black bg-gray-50/50' : 'border-gray-200'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2">
        <button type="button" className="cursor-grab text-gray-400" {...attributes} {...listeners}>
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium text-gray-700">{block.type}</span>
      </div>
      <div className="flex items-center gap-1.5 opacity-0 transition group-hover:opacity-100">
        <Button type="button" size="icon" variant="ghost" onClick={(event) => {
          event.stopPropagation()
          onDuplicate()
        }}>
          <Copy className="h-4 w-4" />
        </Button>
        <Button type="button" size="icon" variant="ghost" onClick={(event) => {
          event.stopPropagation()
          onRemove()
        }}>
          <Trash2 className="h-4 w-4 text-red-600" />
        </Button>
      </div>
    </div>
  )
}
