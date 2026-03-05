'use client'

import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Globe, MessageSquare, Table, Workflow } from 'lucide-react'
import { webhookTemplates } from '@/lib/webhooks/templates'

const ICON_MAP: Record<string, ReactNode> = {
  table: <Table className="h-6 w-6" />,
  workflow: <Workflow className="h-6 w-6" />,
  funnel: <Globe className="h-6 w-6" />,
  hub: <Globe className="h-6 w-6" />,
  message: <MessageSquare className="h-6 w-6" />,
  globe: <Globe className="h-6 w-6" />,
}

interface TemplateSelectorProps {
  selectedTemplate: string | null
  onSelect: (templateName: string) => void
}

export function TemplateSelector({ selectedTemplate, onSelect }: TemplateSelectorProps) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-gray-700">Escolha um template</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {webhookTemplates.map((template) => (
          <Card
            key={template.name}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedTemplate === template.name ? 'ring-2 ring-black bg-gray-50/50' : ''
            }`}
            onClick={() => onSelect(template.name)}
          >
            <CardContent className="flex flex-col items-center gap-2 pt-4 pb-3 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                {ICON_MAP[template.icon] ?? <Globe className="h-6 w-6" />}
              </div>
              <p className="text-sm font-medium">{template.name}</p>
              <p className="line-clamp-2 text-[11px] text-muted-foreground">{template.instructions}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
