'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EmailTemplateBuilder } from '@/components/emails/EmailTemplateBuilder'
import { EmailBlock } from '@/types'

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export default function NewEmailTemplatePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  async function handleSave(payload: {
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
      toast.error('from_email inválido.')
      return
    }

    if (payload.reply_to.trim() && !isValidEmail(payload.reply_to.trim())) {
      toast.error('reply_to inválido.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/email-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/emails"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Novo template</h1>
          <p className="text-muted-foreground">Crie um template de e-mail</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Salvando template...
        </div>
      ) : null}

      <EmailTemplateBuilder
        saving={loading}
        initialForm={{
          name: '',
          subject: '',
          from_name: '',
          from_email: '',
          reply_to: '',
        }}
        onSave={handleSave}
        onCancel={() => router.push('/emails')}
      />
    </div>
  )
}
