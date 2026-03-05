'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { FormField } from '@/types'

export default function NewFormPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiFields, setAiFields] = useState<FormField[] | null>(null)

  async function createForm(options?: { fields?: FormField[] }) {
    const formName = name.trim() || 'Formulario com IA'
    const formDescription = description.trim() || aiPrompt.trim() || null

    const res = await fetch('/api/forms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formName,
        description: formDescription,
        fields: options?.fields,
      }),
    })

    if (!res.ok) throw new Error('Erro ao criar formulario')
    return res.json()
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Nome e obrigatorio')
      return
    }

    setLoading(true)
    try {
      const form = await createForm()
      toast.success('Formulario criado!')
      router.push(`/forms/${form.id}/edit`)
    } catch {
      toast.error('Erro ao criar formulario')
      setLoading(false)
    }
  }

  async function handleGenerateAI() {
    if (!aiPrompt.trim()) {
      toast.error('Descreva o formulario para a IA')
      return
    }

    setAiLoading(true)
    setAiFields(null)

    try {
      const res = await fetch('/api/forms/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: aiPrompt.trim() }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar campos')

      setAiFields(data.fields)
      toast.success('Campos gerados com IA')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao gerar campos')
    } finally {
      setAiLoading(false)
    }
  }

  async function handleCreateWithAI() {
    if (!aiFields || aiFields.length === 0) {
      toast.error('Gere os campos antes de criar')
      return
    }

    setLoading(true)
    try {
      const form = await createForm({ fields: aiFields })
      toast.success('Formulario criado com campos da IA')
      router.push(`/forms/${form.id}/edit`)
    } catch {
      toast.error('Erro ao criar formulario com IA')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/forms">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Novo formulario</h1>
          <p className="text-muted-foreground">Configure dados basicos ou gere com IA</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informacoes basicas</CardTitle>
        </CardHeader>
        <form onSubmit={handleCreate}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do formulario *</Label>
              <Input
                id="name"
                placeholder="Ex: Captacao de leads - Landing Page"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descricao</Label>
              <Textarea
                id="description"
                placeholder="Descreva o objetivo deste formulario..."
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" asChild>
                <Link href="/forms">Cancelar</Link>
              </Button>
              <Button type="submit" className="bg-black hover:bg-gray-800" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar e ir para o builder'
                )}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Gerar com IA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Ex: formulario para captar leads de clinica odontologica, com nome, telefone, email, bairro, servico de interesse e melhor horario para contato"
            rows={3}
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
          />

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleGenerateAI} disabled={aiLoading || loading}>
              {aiLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Gerar campos
                </>
              )}
            </Button>

            <Button
              type="button"
              className="bg-green-600 hover:bg-green-700"
              onClick={handleCreateWithAI}
              disabled={!aiFields || aiFields.length === 0 || loading}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Criar formulario com IA
            </Button>
          </div>

          {aiFields && aiFields.length > 0 ? (
            <div className="space-y-2 rounded-lg border border-gray-200 p-3">
              <p className="text-xs text-muted-foreground">Preview dos campos gerados:</p>
              <div className="flex flex-wrap gap-1.5">
                {aiFields.map((field) => (
                  <Badge key={field.id} variant="secondary" className="text-[11px]">
                    {field.label} ({field.type})
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
