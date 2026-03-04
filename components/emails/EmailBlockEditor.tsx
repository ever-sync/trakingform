'use client'

import { useState } from 'react'
import { EmailBlock } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const MERGE_VARS = [
  { label: 'Nome', token: '{{name}}', description: 'Nome do lead' },
  { label: 'Email', token: '{{email}}', description: 'Email do lead' },
  { label: 'Formulario', token: '{{form_name}}', description: 'Nome do formulario' },
  { label: 'Mensagem', token: '{{submit_message}}', description: 'Mensagem de sucesso do formulario' },
  { label: 'UTM Source', token: '{{utm_source}}', description: 'Origem UTM da campanha' },
  { label: 'Data', token: '{{created_at}}', description: 'Data de envio do lead' },
]

function isValidUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function appendTokenAt(value: string, token: string, pos: number | null) {
  if (pos === null || pos < 0) return appendToken(value, token)
  const start = value.slice(0, pos)
  const end = value.slice(pos)
  const needsSpace = start && !start.endsWith(' ')
  const tokenWithSpace = `${needsSpace ? ' ' : ''}${token}`
  return `${start}${tokenWithSpace}${end}`.trim()
}

function appendToken(value: string, token: string) {
  if (!value) return token
  return `${value} ${token}`.trim()
}

export function EmailBlockEditor({
  block,
  onChange,
}: {
  block: EmailBlock | null
  onChange: (next: EmailBlock) => void
}) {
  const [cursorPos, setCursorPos] = useState<number | null>(null)

  function handleCursor(event: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const target = event.currentTarget
    if ('selectionStart' in target && typeof target.selectionStart === 'number') {
      setCursorPos(target.selectionStart)
    }
  }

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
      ? (!isValidUrl(buttonUrl) && !buttonUrl.includes('{{') ? 'URL invalida.' : null)
      : block.type === 'button'
        ? 'URL do botao obrigatoria.'
        : null
  const imageSrc = block.type === 'image' ? String(block.src ?? '').trim() : ''
  const imageSrcError =
    block.type === 'image' && imageSrc
      ? (!isValidUrl(imageSrc) && !imageSrc.includes('{{') ? 'URL da imagem invalida.' : null)
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
            <Input
              value={block.logoUrl ?? ''}
              onChange={(event) => onChange({ ...block, logoUrl: event.target.value })}
              placeholder="https://..."
            />
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
            <Textarea
              rows={8}
              value={block.content ?? ''}
              onChange={(event) => onChange({ ...block, content: event.target.value })}
              onClick={handleCursor}
              onKeyUp={handleCursor}
              onSelect={handleCursor}
            />
            {textError ? <p className="text-[11px] text-red-600">{textError}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {MERGE_VARS.map((variable) => (
              <Tooltip key={variable.token}>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onChange({
                      ...block,
                      content: appendTokenAt(block.content ?? '', variable.token, cursorPos),
                    })}
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

      {block.type === 'image' && (
        <>
          <div className="space-y-1.5">
            <Label>Imagem URL</Label>
            <Input
              value={block.src ?? ''}
              onChange={(event) => onChange({ ...block, src: event.target.value })}
              placeholder="https://..."
            />
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
                    onClick={() => onChange({ ...block, label: appendTokenAt(block.label ?? '', variable.token, cursorPos) })}
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
        <p className="text-xs text-muted-foreground">Divisor simples sem configuracoes.</p>
      )}

      {block.type === 'footer' && (
        <>
          <div className="space-y-1.5">
            <Label>Conteudo</Label>
            <Textarea
              rows={6}
              value={block.content ?? ''}
              onChange={(event) => onChange({ ...block, content: event.target.value })}
              onClick={handleCursor}
              onKeyUp={handleCursor}
              onSelect={handleCursor}
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
          <div className="flex flex-wrap gap-2">
            {MERGE_VARS.map((variable) => (
              <Tooltip key={variable.token}>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onChange({
                      ...block,
                      content: appendTokenAt(block.content ?? '', variable.token, cursorPos),
                    })}
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
      </div>
    </TooltipProvider>
  )
}
