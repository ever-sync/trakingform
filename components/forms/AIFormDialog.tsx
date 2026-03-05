'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Loader2, Sparkles } from 'lucide-react'
import { FormField } from '@/types'

interface AIFormDialogProps {
  onFieldsGenerated: (fields: FormField[]) => void
}

export function AIFormDialog({ onFieldsGenerated }: AIFormDialogProps) {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<FormField[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    if (!description.trim()) return

    setLoading(true)
    setError(null)
    setPreview(null)

    try {
      const res = await fetch('/api/forms/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: description.trim() }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Erro ao gerar')
      setPreview(data.fields)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  function handleApply() {
    if (preview) {
      onFieldsGenerated(preview)
      setOpen(false)
      setPreview(null)
      setDescription('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          Gerar com IA
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Gerar formulario com IA
          </DialogTitle>
          <DialogDescription>
            Descreva o objetivo do formulario e a IA gerara os campos ideais.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <textarea
            className="w-full rounded-lg border border-gray-200 p-3 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black"
            rows={3}
            placeholder="Ex: Formulario de captacao de leads para uma imobiliaria de alto padrao em Sao Paulo. Preciso coletar informacoes sobre o imovel desejado..."
            value={description}
            onChange={e => setDescription(e.target.value)}
          />

          <Button
            onClick={handleGenerate}
            disabled={loading || !description.trim()}
            className="w-full bg-black hover:bg-gray-800"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gerando campos...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Gerar campos
              </>
            )}
          </Button>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          {preview && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-700">Preview dos campos gerados:</h4>
              <div className="max-h-60 overflow-y-auto space-y-2 rounded-lg border p-3">
                {preview.map((field, i) => (
                  <div key={i} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
                    <div>
                      <span className="text-sm font-medium">{field.label}</span>
                      {field.required && <span className="text-red-500 text-xs ml-1">*</span>}
                    </div>
                    <Badge variant="outline" className="text-[10px]">{field.type}</Badge>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setPreview(null); setDescription('') }}
                >
                  Descartar
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={handleApply}
                >
                  Aplicar campos
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
