'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Mail, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface Template {
  id: string
  name: string
  subject: string
  from_email: string | null
  from_name: string | null
  created_at: string
}

export function EmailTemplatesClient({ templates: initial }: { templates: Template[] }) {
  const [templates, setTemplates] = useState(initial)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/email-templates/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete_failed')
      setTemplates((prev) => prev.filter((template) => template.id !== id))
      toast.success('Template removido')
    } catch {
      toast.error('Erro ao remover template')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-3">
      {templates.map((template) => (
        <Card key={template.id}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                  <Mail className="h-4 w-4 text-black" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">{template.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{template.subject}</p>
                  {template.from_email ? (
                    <p className="text-xs text-muted-foreground">
                      De: {template.from_name ? `${template.from_name} <${template.from_email}>` : template.from_email}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="outline" className="text-xs">{template.created_at}</Badge>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/emails/${template.id}`}>Editar</Link>
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                      disabled={deletingId === template.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover template?</AlertDialogTitle>
                      <AlertDialogDescription>
                        O template &quot;{template.name}&quot; sera removido permanentemente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700"
                        onClick={() => void handleDelete(template.id)}
                      >
                        Remover
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
