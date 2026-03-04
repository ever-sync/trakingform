'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EmailTemplateBuilder } from '@/components/emails/EmailTemplateBuilder'
import { EmailBlock } from '@/types'

interface TemplatePayload {
  id: string
  name: string
  subject: string
  from_name: string | null
  from_email: string | null
  reply_to: string | null
  blocks: unknown
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export default function EditEmailTemplatePage() {
  const params = useParams<{ templateId: string }>()
  const router = useRouter()
  const templateId = params.templateId

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [template, setTemplate] = useState<TemplatePayload | null>(null)

  useEffect(() => {
    fetch(`/api/email-templates/${templateId}`)
      .then(async (res) => {
        const payload = (await res.json()) as { template?: TemplatePayload; error?: string }
        if (!res.ok || !payload.template) {
          throw new Error(payload.error ?? 'Template nao encontrado')
        }

        setTemplate(payload.template)
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Erro ao carregar template')
      })
      .finally(() => setLoading(false))
  }, [templateId])

  async function saveTemplate(payload: {
    name: string
    subject: string
    from_name: string
    from_email: string
    reply_to: string
    blocks: EmailBlock[]
  }) {
    if (!payload.name.trim() || !payload.subject.trim()) {
      toast.error('Nome e assunto sao obrigatorios.')
      return
    }

    if (payload.from_email.trim() && !isValidEmail(payload.from_email.trim())) {
      toast.error('from_email invalido.')
      return
    }

    if (payload.reply_to.trim() && !isValidEmail(payload.reply_to.trim())) {
      toast.error('reply_to invalido.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/email-templates/${templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: payload.name,
          subject: payload.subject,
          from_name: payload.from_name,
          from_email: payload.from_email,
          reply_to: payload.reply_to,
          blocks: payload.blocks,
        }),
      })

      const response = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(response.error ?? 'Falha ao salvar template')

      toast.success('Template atualizado.')
      router.push('/emails')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar template')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando template...
      </div>
    )
  }

  if (!template) {
    return (
      <div className="text-sm text-muted-foreground">
        Template nao encontrado.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/emails"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Editar template</h1>
          <p className="text-muted-foreground">Atualize assunto, remetente e blocos.</p>
        </div>
      </div>

      {saving ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Salvando template...
        </div>
      ) : null}

      <EmailTemplateBuilder
        saving={saving}
        initialForm={{
          name: template.name ?? '',
          subject: template.subject ?? '',
          from_name: template.from_name ?? '',
          from_email: template.from_email ?? '',
          reply_to: template.reply_to ?? '',
        }}
        initialBlocks={Array.isArray(template.blocks) ? (template.blocks as EmailBlock[]) : []}
        onSave={saveTemplate}
        onCancel={() => router.push('/emails')}
      />
    </div>
  )
}
