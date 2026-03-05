'use client'

import {
  Clock,
  Globe,
  Zap,
  Mail,
  BarChart3,
  MessageSquare,
  RefreshCw,
  Plus,
  Trophy,
  MailOpen,
  MousePointerClick,
  MailX,
} from 'lucide-react'

interface TimelineEvent {
  id: string
  type: string
  description: string | null
  metadata: unknown
  created_at: string
}

const EVENT_CONFIG: Record<string, { icon: typeof Clock; color: string; bgLight: string; label: string }> = {
  created:          { icon: Plus,               color: 'bg-emerald-500', bgLight: 'bg-emerald-50',  label: 'Lead capturado' },
  enriched:         { icon: Globe,              color: 'bg-blue-500',    bgLight: 'bg-blue-50',     label: 'Dados enriquecidos' },
  webhook_sent:     { icon: Zap,                color: 'bg-gray-800',  bgLight: 'bg-gray-100',   label: 'Webhook disparado' },
  email_sent:       { icon: Mail,               color: 'bg-orange-500',  bgLight: 'bg-orange-50',   label: 'Email enviado' },
  email_opened:     { icon: MailOpen,            color: 'bg-cyan-500',    bgLight: 'bg-cyan-50',     label: 'Email aberto' },
  email_clicked:    { icon: MousePointerClick,   color: 'bg-teal-500',    bgLight: 'bg-teal-50',     label: 'Link do email clicado' },
  email_failed:     { icon: MailX,               color: 'bg-red-500',     bgLight: 'bg-red-50',      label: 'Falha de envio de email' },
  score_updated:    { icon: BarChart3,           color: 'bg-amber-500',   bgLight: 'bg-amber-50',    label: 'Score atualizado' },
  ab_winner_applied:{ icon: Trophy,              color: 'bg-emerald-500', bgLight: 'bg-emerald-50',  label: 'Vencedora A/B aplicada' },
  status_change:    { icon: RefreshCw,           color: 'bg-gray-1000',  bgLight: 'bg-gray-100',   label: 'Status alterado' },
  note_added:       { icon: MessageSquare,       color: 'bg-gray-500',    bgLight: 'bg-gray-50',     label: 'Nota adicionada' },
}

function formatRelativeTime(dateStr: string) {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'Agora'
  if (diffMin < 60) return `${diffMin}min atrás`
  if (diffHours < 24) return `${diffHours}h atrás`
  if (diffDays < 7) return `${diffDays}d atrás`
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export function LeadTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-gray-400">
        <Clock className="h-8 w-8 mb-2 opacity-40" />
        <p className="text-sm">Nenhum evento registrado.</p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-[15px] top-3 bottom-3 w-px bg-linear-to-b from-gray-200 via-gray-200 to-transparent" />

      <div className="space-y-1">
        {events.map((event, idx) => {
          const config = EVENT_CONFIG[event.type] ?? {
            icon: Clock,
            color: 'bg-gray-400',
            bgLight: 'bg-gray-50',
            label: event.type,
          }
          const Icon = config.icon
          const isFirst = idx === 0

          return (
            <div
              key={event.id}
              className={`relative flex items-start gap-3 rounded-lg px-1 py-2 transition-colors hover:bg-gray-50 ${
                isFirst ? 'opacity-100' : 'opacity-90'
              }`}
            >
              {/* Icon circle */}
              <div
                className={`relative z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full ${config.color} shadow-sm ring-2 ring-white`}
              >
                <Icon className="h-3.5 w-3.5 text-white" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-800">{config.label}</p>
                  <span className="text-[11px] text-gray-400 whitespace-nowrap tabular-nums">
                    {formatRelativeTime(event.created_at)}
                  </span>
                </div>
                {event.description && (
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{event.description}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
