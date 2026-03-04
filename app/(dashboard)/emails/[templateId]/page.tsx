'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

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
  const [form, setForm] = useState({
    name: '',
    subject: '',
    from_name: '',
    from_email: '',
    reply_to: '',
    blocksJson: '[]',
  })

  useEffect(() => {
    fetch(`/api/email-templates/${templateId}`)
      .then(async (res) => {
        const payload = (await res.json()) as { template?: TemplatePayload; error?: string }
        if (!res.ok || !payload.template) {
          throw new Error(payload.error ?? 'Template nao encontrado')
        }

        setForm({
          name: payload.template.name ?? '',
          subject: payload.template.subject ?? '',
          from_name: payload.template.from_name ?? '',
          from_email: payload.template.from_email ?? '',
          reply_to: payload.template.reply_to ?? '',
          blocksJson: JSON.stringify(payload.template.blocks ?? [], null, 2),
        })
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Erro ao carregar template')
      })
      .finally(() => setLoading(false))
  }, [templateId])

  async function saveTemplate(event: React.FormEvent) {
    event.preventDefault()

    if (!form.name.trim() || !form.subject.trim()) {
      toast.error('Nome e assunto sao obrigatorios.')
      return
    }

    if (form.from_email.trim() && !isValidEmail(form.from_email.trim())) {
      toast.error('from_email invalido.')
      return
    }

    if (form.reply_to.trim() && !isValidEmail(form.reply_to.trim())) {
      toast.error('reply_to invalido.')
      return
    }

    let blocks: unknown
    try {
      blocks = JSON.parse(form.blocksJson)
      if (!Array.isArray(blocks)) throw new Error('blocks precisa ser um array JSON')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'JSON de blocks invalido')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/email-templates/${templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          subject: form.subject,
          from_name: form.from_name,
          from_email: form.from_email,
          reply_to: form.reply_to,
          blocks,
        }),
      })

      const payload = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(payload.error ?? 'Falha ao salvar template')

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

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/emails"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Editar template</h1>
          <p className="text-muted-foreground">Atualize assunto, remetente e blocos.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Template</CardTitle>
        </CardHeader>
        <form onSubmit={saveTemplate}>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="name">Nome *</Label>
                <Input id="name" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="subject">Assunto *</Label>
                <Input id="subject" value={form.subject} onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="from_name">De (nome)</Label>
                <Input id="from_name" value={form.from_name} onChange={(event) => setForm((prev) => ({ ...prev, from_name: event.target.value }))} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="from_email">De (e-mail)</Label>
                <Input id="from_email" type="email" value={form.from_email} onChange={(event) => setForm((prev) => ({ ...prev, from_email: event.target.value }))} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="reply_to">Reply-To</Label>
                <Input id="reply_to" type="email" value={form.reply_to} onChange={(event) => setForm((prev) => ({ ...prev, reply_to: event.target.value }))} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="blocks">Blocks (JSON array)</Label>
                <Textarea
                  id="blocks"
                  rows={14}
                  value={form.blocksJson}
                  onChange={(event) => setForm((prev) => ({ ...prev, blocksJson: event.target.value }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" asChild>
                <Link href="/emails">Cancelar</Link>
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                Salvar
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}
