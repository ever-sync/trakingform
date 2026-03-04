'use client'

import { Clock, Globe, Zap, Mail, BarChart3, MessageSquare, RefreshCw, Plus, Trophy } from 'lucide-react'

interface TimelineEvent {
  id: string
  type: string
  description: string | null
  metadata: unknown
  created_at: string
}

const EVENT_CONFIG: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  created: { icon: Plus, color: 'bg-green-500', label: 'Lead capturado' },
  enriched: { icon: Globe, color: 'bg-blue-500', label: 'Dados enriquecidos' },
  webhook_sent: { icon: Zap, color: 'bg-purple-500', label: 'Webhook disparado' },
  email_sent: { icon: Mail, color: 'bg-orange-500', label: 'Email enviado' },
  email_opened: { icon: Mail, color: 'bg-cyan-500', label: 'Email aberto' },
  email_clicked: { icon: Mail, color: 'bg-teal-500', label: 'Link do email clicado' },
  email_failed: { icon: Mail, color: 'bg-red-500', label: 'Falha de envio de email' },
  score_updated: { icon: BarChart3, color: 'bg-yellow-500', label: 'Score atualizado' },
  ab_winner_applied: { icon: Trophy, color: 'bg-emerald-500', label: 'Vencedora A/B aplicada' },
  status_change: { icon: RefreshCw, color: 'bg-indigo-500', label: 'Status alterado' },
  note_added: { icon: MessageSquare, color: 'bg-gray-500', label: 'Nota adicionada' },
}

export function LeadTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Nenhum evento registrado.
      </p>
    )
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
      <div className="space-y-4">
        {events.map((event) => {
          const config = EVENT_CONFIG[event.type] ?? { icon: Clock, color: 'bg-gray-400', label: event.type }
          const Icon = config.icon

          return (
            <div key={event.id} className="relative flex items-start gap-3 pl-2">
              <div className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${config.color}`}>
                <Icon className="h-3 w-3 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{config.label}</p>
                {event.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(event.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
