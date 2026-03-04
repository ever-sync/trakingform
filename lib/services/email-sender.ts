import { Resend } from 'resend'
import { EmailBlock } from '@/types'

const resend = new Resend(process.env.RESEND_API_KEY)

function replaceVariables(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? '')
}

function renderBlock(block: EmailBlock, vars: Record<string, string>): string {
  switch (block.type) {
    case 'header':
      return `<div style="background:${block.backgroundColor || '#000'};padding:24px;text-align:center;">
        ${block.logoUrl ? `<img src="${block.logoUrl}" height="40" alt="logo"/>` : ''}
      </div>`
    case 'text':
      return `<div style="padding:24px;font-family:sans-serif;font-size:16px;color:#333;line-height:1.6;">
        ${replaceVariables(block.content || '', vars)}
      </div>`
    case 'button':
      return `<div style="padding:16px;text-align:center;">
        <a href="${replaceVariables(block.url || '#', vars)}"
           style="background:${block.color || '#6366f1'};color:white;padding:12px 32px;border-radius:6px;text-decoration:none;font-family:sans-serif;font-weight:600;">
          ${replaceVariables(block.label || 'Clique aqui', vars)}
        </a>
      </div>`
    case 'image':
      return `<div style="padding:16px;text-align:center;">
        <img src="${block.src}" alt="${block.alt || ''}" style="max-width:100%;border-radius:8px;"/>
      </div>`
    case 'divider':
      return `<hr style="border:none;border-top:1px solid #eee;margin:8px 24px;"/>`
    case 'footer':
      return `<div style="padding:24px;text-align:center;font-size:12px;color:#999;font-family:sans-serif;">
        ${replaceVariables(block.content || '', vars)}
        ${block.unsubscribeUrl ? `<br/><a href="${replaceVariables(block.unsubscribeUrl, vars)}" style="color:#999;">Descadastrar</a>` : ''}
      </div>`
    default:
      return ''
  }
}

function wrapInEmailLayout(content: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:32px 0;">
<table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
<tr><td>${content}</td></tr>
</table>
</td></tr>
</table>
</body></html>`
}

export function renderEmailBlocks(blocks: EmailBlock[], variables: Record<string, string>): string {
  const html = blocks.map(block => renderBlock(block, variables)).join('\n')
  return wrapInEmailLayout(html)
}

export async function sendEmailToLead({
  to,
  subject,
  blocks,
  variables,
  fromName,
  fromEmail,
}: {
  to: string
  subject: string
  blocks: EmailBlock[]
  variables: Record<string, string>
  fromName: string
  fromEmail: string
}) {
  const html = renderEmailBlocks(blocks, variables)
  return resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to,
    subject: replaceVariables(subject, variables),
    html,
  })
}
