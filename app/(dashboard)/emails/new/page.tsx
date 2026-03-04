'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export default function NewEmailTemplatePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    subject: '',
    from_name: '',
    from_email: '',
    reply_to: '',
  })

  function set(field: keyof typeof form) {
    return (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  async function handleSubmit(event: React.FormEvent) {
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

    setLoading(true)
    try {
      const res = await fetch('/api/email-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error ?? 'Erro ao criar template')
      }

      toast.success('Template criado.')
      router.push('/emails')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar template')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/emails"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Novo template</h1>
          <p className="text-muted-foreground">Crie um template de e-mail</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informacoes basicas</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do template *</Label>
              <Input
                id="name"
                placeholder="Ex: Boas-vindas ao lead"
                value={form.name}
                onChange={set('name')}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Assunto *</Label>
              <Input
                id="subject"
                placeholder="Ex: Ola {{name}}, obrigado pelo contato"
                value={form.subject}
                onChange={set('subject')}
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="from_name">De (nome)</Label>
                <Input
                  id="from_name"
                  placeholder="Equipe LeadForm"
                  value={form.from_name}
                  onChange={set('from_name')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="from_email">De (e-mail)</Label>
                <Input
                  id="from_email"
                  type="email"
                  placeholder="contato@empresa.com"
                  value={form.from_email}
                  onChange={set('from_email')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reply_to">Responder para</Label>
              <Input
                id="reply_to"
                type="email"
                placeholder="respostas@empresa.com"
                value={form.reply_to}
                onChange={set('reply_to')}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" asChild>
                <Link href="/emails">Cancelar</Link>
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Criar template
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}
