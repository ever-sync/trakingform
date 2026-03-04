'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Mail, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

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
      if (!res.ok) throw new Error()
      setTemplates(prev => prev.filter(t => t.id !== id))
      toast.success('Template removido')
    } catch {
      toast.error('Erro ao remover template')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-3">
      {templates.map(template => (
        <Card key={template.id}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                  <Mail className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{template.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{template.subject}</p>
                  {template.from_email && (
                    <p className="text-xs text-muted-foreground">
                      De: {template.from_name ? `${template.from_name} <${template.from_email}>` : template.from_email}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="text-xs">{template.created_at}</Badge>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                      disabled={deletingId === template.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover template?</AlertDialogTitle>
                      <AlertDialogDescription>
                        O template &quot;{template.name}&quot; será removido permanentemente.
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
