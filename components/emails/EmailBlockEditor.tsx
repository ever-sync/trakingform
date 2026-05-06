'use client'

import { useRef, useState } from 'react'
import { EmailBlock } from '@/types'
import { isValidUrl } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { TipTapEditor } from '@/components/emails/TipTapEditor'
import { toast } from 'sonner'
import { Loader2, Upload } from 'lucide-react'

const MERGE_VARS = [
  { label: 'Nome', token: '{{name}}', description: 'Nome do lead' },
  { label: 'Email', token: '{{email}}', description: 'Email do lead' },
  { label: 'Formulario', token: '{{form_name}}', description: 'Nome do formulario' },
  { label: 'Mensagem', token: '{{submit_message}}', description: 'Mensagem de sucesso do formulario' },
  { label: 'UTM Source', token: '{{utm_source}}', description: 'Origem UTM da campanha' },
  { label: 'Data', token: '{{created_at}}', description: 'Data de envio do lead' },
]

function ImageUploadButton({ onUpload }: { onUpload: (url: string) => void }) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/uploads/email-image', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Falha ao enviar imagem')
      onUpload(data.url)
      toast.success('Imagem enviada.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao enviar imagem')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
        {uploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
        Upload
      </Button>
    </>
  )
}

export function EmailBlockEditor({
  block,
  onChange,
}: {
  block: EmailBlock | null
  onChange: (next: EmailBlock) => void
}) {
  if (!block) {
    return <p className="text-xs text-muted-foreground">Selecione um bloco para editar.</p>
  }

  const textError =
    block.type === 'text' && !String(block.content ?? '').trim()
      ? 'Conteudo obrigatorio.'
      : null
  const footerError =
    block.type === 'footer' && !String(block.content ?? '').trim()
      ? 'Conteudo obrigatorio.'
      : null
  const buttonLabelError =
    block.type === 'button' && !String(block.label ?? '').trim()
      ? 'Texto do botao obrigatorio.'
      : null
  const buttonUrl = block.type === 'button' ? String(block.url ?? '').trim() : ''
  const buttonUrlError =
    block.type === 'button' && buttonUrl
      ? (!isValidUrl(buttonUrl) && !buttonUrl.includes('{{') ? 'URL inválida.' : null)
      : block.type === 'button'
        ? 'URL do botao obrigatoria.'
        : null
  const imageSrc = block.type === 'image' ? String(block.src ?? '').trim() : ''
  const imageSrcError =
    block.type === 'image' && imageSrc
      ? (!isValidUrl(imageSrc) && !imageSrc.includes('{{') ? 'URL da imagem inválida.' : null)
      : block.type === 'image'
        ? 'URL da imagem obrigatoria.'
        : null

  return (
    <TooltipProvider>
      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-600">Editar bloco</p>

      {block.type === 'header' && (
        <>
          <div className="space-y-1.5">
            <Label>Logo URL</Label>
            <div className="flex gap-2">
              <Input
                value={block.logoUrl ?? ''}
                onChange={(event) => onChange({ ...block, logoUrl: event.target.value })}
                placeholder="https://..."
                className="flex-1"
              />
              <ImageUploadButton onUpload={(url) => onChange({ ...block, logoUrl: url })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Cor de fundo</Label>
            <Input
              type="color"
              value={block.backgroundColor ?? '#111827'}
              onChange={(event) => onChange({ ...block, backgroundColor: event.target.value })}
            />
          </div>
        </>
      )}

      {block.type === 'text' && (
        <>
          <div className="space-y-1.5">
            <Label>Conteudo</Label>
            <TipTapEditor
              content={block.content ?? ''}
              onChange={(html) => onChange({ ...block, content: html })}
              mergeVars={MERGE_VARS}
            />
            {textError ? <p className="text-[11px] text-red-600">{textError}</p> : null}
          </div>
        </>
      )}

      {block.type === 'image' && (
        <>
          <div className="space-y-1.5">
            <Label>Imagem URL</Label>
            <div className="flex gap-2">
              <Input
                value={block.src ?? ''}
                onChange={(event) => onChange({ ...block, src: event.target.value })}
                placeholder="https://..."
                className="flex-1"
              />
              <ImageUploadButton onUpload={(url) => onChange({ ...block, src: url })} />
            </div>
            {imageSrcError ? <p className="text-[11px] text-red-600">{imageSrcError}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label>Alt text</Label>
            <Input
              value={block.alt ?? ''}
              onChange={(event) => onChange({ ...block, alt: event.target.value })}
            />
          </div>
        </>
      )}

      {block.type === 'button' && (
        <>
          <div className="space-y-1.5">
            <Label>Texto do botao</Label>
            <Input
              value={block.label ?? ''}
              onChange={(event) => onChange({ ...block, label: event.target.value })}
            />
            {buttonLabelError ? <p className="text-[11px] text-red-600">{buttonLabelError}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label>URL do botao</Label>
            <Input
              value={block.url ?? ''}
              onChange={(event) => onChange({ ...block, url: event.target.value })}
              placeholder="https://..."
            />
            {buttonUrlError ? <p className="text-[11px] text-red-600">{buttonUrlError}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label>Cor do botao</Label>
            <Input
              type="color"
              value={block.color ?? '#4f46e5'}
              onChange={(event) => onChange({ ...block, color: event.target.value })}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {MERGE_VARS.map((variable) => (
              <Tooltip key={variable.token}>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onChange({ ...block, label: `${block.label ?? ''} ${variable.token}`.trim() })}
                  >
                    {variable.label}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{variable.description} ({variable.token})</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </>
      )}

      {block.type === 'divider' && (
        <>
          <div className="space-y-1.5">
            <Label>Cor</Label>
            <Input
              type="color"
              value={block.dividerColor ?? '#e5e7eb'}
              onChange={(event) => onChange({ ...block, dividerColor: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Espessura ({block.dividerThickness ?? 1}px)</Label>
            <input
              type="range"
              min={1}
              max={4}
              step={1}
              value={block.dividerThickness ?? 1}
              onChange={(event) => onChange({ ...block, dividerThickness: Number(event.target.value) })}
              className="w-full"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Margem ({block.dividerMargin ?? 8}px)</Label>
            <input
              type="range"
              min={8}
              max={32}
              step={4}
              value={block.dividerMargin ?? 8}
              onChange={(event) => onChange({ ...block, dividerMargin: Number(event.target.value) })}
              className="w-full"
            />
          </div>
        </>
      )}

      {block.type === 'footer' && (
        <>
          <div className="space-y-1.5">
            <Label>Conteudo</Label>
            <TipTapEditor
              content={block.content ?? ''}
              onChange={(html) => onChange({ ...block, content: html })}
              mergeVars={MERGE_VARS}
            />
            {footerError ? <p className="text-[11px] text-red-600">{footerError}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label>Link de descadastro</Label>
            <Input
              value={block.unsubscribeUrl ?? ''}
              onChange={(event) => onChange({ ...block, unsubscribeUrl: event.target.value })}
              placeholder="{{unsubscribe_url}}"
            />
          </div>
        </>
      )}
      </div>
    </TooltipProvider>
  )
}
