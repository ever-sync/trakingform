import DOMPurify from 'isomorphic-dompurify'
import { EmailBlock } from '@/types'

const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'u', 'span', 'b', 'i']
const ALLOWED_ATTR = ['href', 'target', 'rel', 'style', 'class']

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR })
}

export function replaceTemplateVariables(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => variables[key] ?? '')
}

function renderBlock(block: EmailBlock, vars: Record<string, string>): string {
  switch (block.type) {
    case 'header':
      return `<div style="background:${block.backgroundColor || '#111827'};padding:24px;text-align:center;">${block.logoUrl ? `<img src="${sanitize(block.logoUrl)}" height="40" alt="logo"/>` : ''}</div>`
    case 'text':
      return `<div style="padding:24px;font-family:Arial,sans-serif;font-size:16px;color:#111827;line-height:1.6;">${sanitize(replaceTemplateVariables(block.content || '', vars))}</div>`
    case 'button':
      return `<div style="padding:16px;text-align:center;"><a href="${replaceTemplateVariables(block.url || '#', vars)}" style="background:${block.color || '#4f46e5'};color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-family:Arial,sans-serif;font-weight:600;display:inline-block;">${sanitize(replaceTemplateVariables(block.label || 'Clique aqui', vars))}</a></div>`
    case 'image':
      return `<div style="padding:16px;text-align:center;"><img src="${block.src || ''}" alt="${sanitize(block.alt || '')}" style="max-width:100%;border-radius:8px;"/></div>`
    case 'divider': {
      const dColor = block.dividerColor || '#e5e7eb'
      const dThickness = block.dividerThickness ?? 1
      const dMargin = block.dividerMargin ?? 8
      return `<hr style="border:none;border-top:${dThickness}px solid ${dColor};margin:${dMargin}px 24px;"/>`
    }
    case 'footer':
      return `<div style="padding:24px;text-align:center;font-size:12px;color:#6b7280;font-family:Arial,sans-serif;">${sanitize(replaceTemplateVariables(block.content || '', vars))}${block.unsubscribeUrl ? `<br/><a href="${replaceTemplateVariables(block.unsubscribeUrl, vars)}" style="color:#6b7280;">Descadastrar</a>` : ''}</div>`
    default:
      return ''
  }
}

function wrapInLayout(content: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0;padding:0;background:#f3f4f6;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px;"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);"><tr><td>${content}</td></tr></table></td></tr></table></body></html>`
}

export function renderEmailBlocks(blocks: EmailBlock[], variables: Record<string, string>): string {
  const html = blocks.map((block) => renderBlock(block, variables)).join('\n')
  return wrapInLayout(html)
}

export function renderBlocksAsText(blocks: EmailBlock[], variables: Record<string, string>): string {
  return blocks
    .map((block) => {
      if (block.type === 'text' || block.type === 'footer') return replaceTemplateVariables(block.content || '', variables)
      if (block.type === 'button') return `${replaceTemplateVariables(block.label || 'Clique aqui', variables)}: ${replaceTemplateVariables(block.url || '', variables)}`
      return ''
    })
    .filter(Boolean)
    .join('\n\n')
}
