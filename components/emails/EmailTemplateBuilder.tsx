'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmailBlocksPalette } from '@/components/emails/EmailBlocksPalette'
import { EmailBlockEditor } from '@/components/emails/EmailBlockEditor'
import { renderEmailBlocks } from '@/lib/services/email/render'
import { Badge } from '@/components/ui/badge'
import { GripVertical, Trash2, Copy } from 'lucide-react'

type TemplateFormState = {
  name: string
  subject: string
  from_name: string
  from_email: string
  reply_to: string
}

const DEFAULT_BLOCKS: EmailBlock[] = [
  { id: 'header_1', type: 'header', backgroundColor: '#111827', logoUrl: '' },
  { id: 'text_1', type: 'text', content: 'Ola {{name}}, obrigado pelo contato!' },
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
      { id: 'text_1', type: 'text', content: 'Ola {{name}}, recebemos sua solicitacao no formulario {{form_name}}.' },
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
      { id: 'text_1', type: 'text', content: 'Ola {{name}}, seja bem-vindo(a)! Em breve entraremos em contato.' },
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
      { id: 'text_1', type: 'text', content: 'Ola {{name}}, estamos a disposicao para tirar duvidas.' },
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

function isValidUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
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
        errors.push(`${label}: URL invalida.`)
      }
    }
    if (block.type === 'image') {
      const src = String(block.src ?? '').trim()
      if (!src) {
        errors.push(`${label}: URL da imagem obrigatoria.`)
      } else if (!isValidUrl(src) && !src.includes('{{')) {
        errors.push(`${label}: URL da imagem invalida.`)
      }
    }
  })

  return errors
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function getFormErrors(form: TemplateFormState) {
  const errors: string[] = []
  if (form.subject.trim().length < 5) {
    errors.push('Assunto precisa ter pelo menos 5 caracteres.')
  }
  if (form.from_email.trim() && !isValidEmail(form.from_email.trim())) {
    errors.push('De (email) invalido.')
  }
  if (form.reply_to.trim() && !isValidEmail(form.reply_to.trim())) {
    errors.push('Reply-to invalido.')
  }
  return errors
}

export function EmailTemplateBuilder({
  initialForm,
  initialBlocks,
  saving,
  onSave,
  onCancel,
}: {
  initialForm: TemplateFormState
  initialBlocks?: EmailBlock[]
  saving?: boolean
  onSave: (payload: TemplateFormState & { blocks: EmailBlock[] }) => void
  onCancel?: () => void
}) {
  const [form, setForm] = useState<TemplateFormState>(initialForm)
  const [blocks, setBlocks] = useState<EmailBlock[]>(initialBlocks?.length ? initialBlocks : DEFAULT_BLOCKS)
  const [selectedId, setSelectedId] = useState<string | null>(blocks[0]?.id ?? null)
  const [tab, setTab] = useState<'editor' | 'preview'>('editor')
  const [presetId, setPresetId] = useState('')
  const [previewVars, setPreviewVars] = useState<Record<string, string>>(DEFAULT_PREVIEW_VARS)
  const [blockErrors, setBlockErrors] = useState<string[]>([])
  const [formErrors, setFormErrors] = useState<string[]>([])

  const selectedBlock = blocks.find((block) => block.id === selectedId) ?? null

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const previewHtml = useMemo(() => renderEmailBlocks(blocks, previewVars), [blocks, previewVars])

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setBlocks((prev) => {
      const oldIndex = prev.findIndex((block) => block.id === active.id)
      const newIndex = prev.findIndex((block) => block.id === over.id)
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  function addBlock(type: EmailBlock['type']) {
    const newBlock = buildBlock(type)
    setBlocks((prev) => [...prev, newBlock])
    setSelectedId(newBlock.id)
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
    setBlocks((prev) => prev.map((block) => (block.id === next.id ? next : block)))
    setBlockErrors([])
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((block) => block.id !== id))
    if (selectedId === id) {
      const remaining = blocks.filter((block) => block.id !== id)
      setSelectedId(remaining[0]?.id ?? null)
    }
    setBlockErrors([])
  }

  function duplicateBlock(id: string) {
    const block = blocks.find((item) => item.id === id)
    if (!block) return
    const clone = { ...block, id: `${block.type}_${crypto.randomUUID()}` }
    setBlocks((prev) => {
      const index = prev.findIndex((item) => item.id === id)
      const next = [...prev]
      next.splice(index + 1, 0, clone)
      return next
    })
    setSelectedId(clone.id)
    setBlockErrors([])
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
    <form onSubmit={submit} className="flex h-full overflow-hidden rounded-xl border bg-white shadow-sm">
      <EmailBlocksPalette onAdd={addBlock} />

      <div className="flex flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-gray-50/80 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Template</span>
            <Badge variant="outline" className="h-5 text-[11px]">{blocks.length} bloco(s)</Badge>
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
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
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
                }}
                placeholder="Ex: Ola {{name}}, obrigado!"
                required
              />
              <p className="text-[11px] text-muted-foreground">Minimo de 5 caracteres.</p>
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
                }}
                placeholder="contato@empresa.com"
              />
              {form.from_email.trim() && !isValidEmail(form.from_email.trim()) ? (
                <p className="text-[11px] text-red-600">Email invalido.</p>
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
                }}
                placeholder="respostas@empresa.com"
              />
              {form.reply_to.trim() && !isValidEmail(form.reply_to.trim()) ? (
                <p className="text-[11px] text-red-600">Email invalido.</p>
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
                <Button type="button" variant="outline" size="sm" onClick={applyPreset} disabled={!presetId}>
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
            {blocks.length === 0 ? (
              <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 px-4 text-center">
                <div className="mb-2 text-3xl">[]</div>
                <p className="text-sm font-medium text-gray-700">Canvas vazio</p>
                <p className="mt-1 text-xs text-gray-400">Adicione blocos no painel esquerdo.</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
              </DndContext>
            )}
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
                  <p className="text-xs text-muted-foreground">Preview com dados reais (ultimo lead).</p>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={loadLatestLeadPreview}>
                      Usar ultimo lead
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={resetPreviewVars}>
                      Resetar
                    </Button>
                  </div>
                </div>
                <div className="h-[520px] overflow-hidden rounded-lg border">
                  <iframe title="preview" className="h-full w-full" srcDoc={previewHtml} />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </form>
  )
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
        selected ? 'border-indigo-500 bg-indigo-50/50' : 'border-gray-200'
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
