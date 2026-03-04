'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { webhookTemplates } from '@/lib/webhooks/templates'
import { TemplateSelector } from '@/components/webhooks/TemplateSelector'

export default function NewWebhookPage() {
  const router = useRouter()
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)

  const template = webhookTemplates.find(t => t.name === selectedTemplate)

  async function handleCreate() {
    if (!name.trim() || !url.trim()) {
      toast.error('Preencha nome e URL.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          url: url.trim(),
          type: template?.type ?? 'generic',
          method: template?.method ?? 'POST',
          headers: template?.headers ?? { 'Content-Type': 'application/json' },
          payload_template: template?.payload_template ?? null,
        }),
      })

      if (!res.ok) throw new Error('Failed')
      toast.success('Webhook criado!')
      router.push('/webhooks')
    } catch {
      toast.error('Erro ao criar webhook.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/webhooks"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Novo destino webhook</h1>
          <p className="text-muted-foreground">Escolha um template ou configure manualmente</p>
        </div>
      </div>

      <TemplateSelector
        selectedTemplate={selectedTemplate}
        onSelect={(templateName) => {
          setSelectedTemplate(templateName)
          if (!name) setName(templateName)
        }}
      />

      {/* Config form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {template ? `Configurar ${template.name}` : 'Configuracao'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {template && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
              {template.instructions}
            </div>
          )}

          <div className="space-y-2">
            <Label>Nome do destino</Label>
            <Input
              placeholder="Ex: n8n - Notificacao WhatsApp"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>URL do webhook</Label>
            <Input
              placeholder="https://..."
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
            />
          </div>

          {template?.headers && Object.keys(template.headers).length > 1 && (
            <div className="space-y-2">
              <Label className="text-xs text-gray-500">Headers pre-configurados</Label>
              <pre className="bg-gray-100 rounded p-2 text-xs overflow-x-auto">
                {JSON.stringify(template.headers, null, 2)}
              </pre>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" asChild><Link href="/webhooks">Cancelar</Link></Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700"
              onClick={handleCreate}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar destino
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
