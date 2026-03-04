'use client'

import { useState, useEffect } from 'react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Badge } from '@/components/ui/badge'
import { LeadTimeline } from './LeadTimeline'
import { ScoreBreakdown } from './ScoreBreakdown'
import {
  Globe,
  Monitor,
  Clock,
  ExternalLink,
  Loader2,
  User,
  Mail,
  FileText,
  MapPin,
  Smartphone,
  Shield,
  Megaphone,
  Link2,
  Tag,
  Copy,
  Check,
} from 'lucide-react'

interface LeadDetailDrawerProps {
  leadId: string | null
  onClose: () => void
}

interface LeadDetail {
  id: string
  data: Record<string, unknown>
  status: string
  score: number
  is_duplicate: boolean
  ip_address: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  referrer: string | null
  time_to_complete_seconds: number | null
  created_at: string
  form_name: string | null
  enrichment: {
    city: string | null
    region: string | null
    country: string | null
    browser: string | null
    os: string | null
    device_type: string | null
    is_vpn: boolean
    is_mobile: boolean
  } | null
  events: {
    id: string
    type: string
    description: string | null
    metadata: unknown
    created_at: string
  }[]
}

function parseScoreFactors(events: LeadDetail['events']) {
  const scoreEvent = events.find((event) => event.type === 'score_updated')
  if (!scoreEvent?.metadata || typeof scoreEvent.metadata !== 'object' || Array.isArray(scoreEvent.metadata)) {
    return []
  }

  const metadata = scoreEvent.metadata as { factors?: unknown }
  if (!Array.isArray(metadata.factors)) return []

  return metadata.factors.filter((factor): factor is { name: string; impact: number; description: string } => {
    if (!factor || typeof factor !== 'object' || Array.isArray(factor)) return false
    const candidate = factor as Record<string, unknown>
    return (
      typeof candidate.name === 'string' &&
      typeof candidate.impact === 'number' &&
      typeof candidate.description === 'string'
    )
  })
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'new':
      return { label: 'Novo', className: 'bg-blue-50 text-blue-700 border-blue-200' }
    case 'contacted':
      return { label: 'Contactado', className: 'bg-purple-50 text-purple-700 border-purple-200' }
    case 'qualified':
      return { label: 'Qualificado', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    case 'converted':
      return { label: 'Convertido', className: 'bg-green-50 text-green-700 border-green-200' }
    case 'lost':
      return { label: 'Perdido', className: 'bg-red-50 text-red-700 border-red-200' }
    default:
      return { label: status, className: 'bg-gray-50 text-gray-700 border-gray-200' }
  }
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function formatFieldLabel(key: string) {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
}

function SectionCard({ icon: Icon, title, children }: { icon: typeof Globe; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
        <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-gray-50">
          <Icon className="h-3.5 w-3.5 text-gray-500" />
        </div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</h4>
      </div>
      <div className="px-4 py-3">
        {children}
      </div>
    </div>
  )
}

function CopyableText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-sm font-medium text-gray-900 hover:text-indigo-600 transition-colors group"
    >
      {text}
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </button>
  )
}

function InfoRow({ icon: Icon, label, value, className }: { icon?: typeof Globe; label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${className ?? ''}`}>
      <div className="flex items-center gap-2 text-sm text-gray-500">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        <span>{label}</span>
      </div>
      <div className="text-sm font-medium text-gray-900 text-right max-w-[60%] truncate">
        {value}
      </div>
    </div>
  )
}

export function LeadDetailDrawer({ leadId, onClose }: LeadDetailDrawerProps) {
  const [lead, setLead] = useState<LeadDetail | null>(null)
  const loading = !!leadId && (!lead || lead.id !== leadId)
  const scoreFactors = lead ? parseScoreFactors(lead.events) : []

  useEffect(() => {
    if (!leadId) return

    let cancelled = false
    fetch(`/api/leads/${leadId}`)
      .then(res => res.json())
      .then((result) => {
        if (!cancelled) setLead(result)
      })
      .catch(console.error)

    return () => {
      cancelled = true
    }
  }, [leadId])

  const leadName = lead ? String(lead.data.name || lead.data.nome || 'Lead sem nome') : ''
  const leadEmail = lead ? String(lead.data.email || '') : ''
  const leadPhone = lead ? String(lead.data.phone || lead.data.telefone || lead.data.whatsapp || '') : ''
  const statusConfig = lead ? getStatusConfig(lead.status) : null

  return (
    <Drawer open={!!leadId} onClose={onClose}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="sr-only">
          <DrawerTitle>Detalhes do Lead</DrawerTitle>
        </DrawerHeader>

        <div className="overflow-y-auto px-5 pb-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
              <p className="text-sm text-muted-foreground">Carregando detalhes...</p>
            </div>
          ) : lead ? (
            <div className="space-y-4">
              {/* ── Hero Header ── */}
              <div className="flex items-start gap-4 py-2">
                <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-linear-to-br from-indigo-500 to-purple-600 text-white font-bold text-lg shadow-md shrink-0">
                  {getInitials(leadName)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-xl text-gray-900 truncate">{leadName}</h3>
                  {leadEmail && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Mail className="h-3.5 w-3.5 text-gray-400" />
                      <CopyableText text={leadEmail} />
                    </div>
                  )}
                  {leadPhone && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Smartphone className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-sm text-gray-600">{leadPhone}</span>
                    </div>
                  )}
                  {lead.form_name && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <FileText className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-xs text-gray-500">{lead.form_name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Badges row ── */}
              <div className="flex flex-wrap items-center gap-2">
                {statusConfig && (
                  <Badge variant="outline" className={`${statusConfig.className} font-medium`}>
                    {statusConfig.label}
                  </Badge>
                )}
                {lead.is_duplicate && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-medium">
                    Duplicado
                  </Badge>
                )}
                {lead.enrichment?.is_vpn && (
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 font-medium">
                    <Shield className="h-3 w-3 mr-1" />
                    VPN
                  </Badge>
                )}
                {lead.time_to_complete_seconds != null && (
                  <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200 font-medium">
                    <Clock className="h-3 w-3 mr-1" />
                    {lead.time_to_complete_seconds}s
                  </Badge>
                )}
                <span className="text-xs text-gray-400 ml-auto">
                  {new Date(lead.created_at).toLocaleString('pt-BR')}
                </span>
              </div>

              {/* ── Score ── */}
              <ScoreBreakdown score={lead.score} factors={scoreFactors} />

              {/* ── Origin / UTM ── */}
              {(lead.utm_source || lead.utm_medium || lead.utm_campaign || lead.referrer) && (
                <SectionCard icon={Megaphone} title="Origem & Campanha">
                  <div className="space-y-0.5">
                    {lead.utm_source && (
                      <InfoRow icon={Tag} label="Fonte" value={lead.utm_source} />
                    )}
                    {lead.utm_medium && (
                      <InfoRow icon={Link2} label="Meio" value={lead.utm_medium} />
                    )}
                    {lead.utm_campaign && (
                      <InfoRow icon={Megaphone} label="Campanha" value={lead.utm_campaign} />
                    )}
                    {lead.referrer && (
                      <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-gray-50 text-xs text-gray-500">
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="truncate">{lead.referrer}</span>
                      </div>
                    )}
                  </div>
                </SectionCard>
              )}

              {/* ── Device & Location ── */}
              {lead.enrichment && (
                <SectionCard icon={Monitor} title="Dispositivo & Localização">
                  <div className="space-y-0.5">
                    {(lead.enrichment.city || lead.enrichment.country) && (
                      <InfoRow
                        icon={MapPin}
                        label="Localização"
                        value={[lead.enrichment.city, lead.enrichment.region, lead.enrichment.country].filter(Boolean).join(', ')}
                      />
                    )}
                    {lead.enrichment.browser && (
                      <InfoRow
                        icon={Globe}
                        label="Navegador"
                        value={`${lead.enrichment.browser} / ${lead.enrichment.os}`}
                      />
                    )}
                    {lead.enrichment.device_type && (
                      <InfoRow
                        icon={lead.enrichment.is_mobile ? Smartphone : Monitor}
                        label="Dispositivo"
                        value={<span className="capitalize">{lead.enrichment.device_type}</span>}
                      />
                    )}
                  </div>
                </SectionCard>
              )}

              {/* ── Form Data ── */}
              <SectionCard icon={FileText} title="Dados do Formulário">
                <div className="divide-y divide-gray-50">
                  {Object.entries(lead.data).map(([key, value]) => {
                    const strVal = String(value ?? '')
                    if (!strVal) return null
                    return (
                      <div key={key} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                        <span className="text-sm text-gray-500">{formatFieldLabel(key)}</span>
                        <span className="text-sm font-medium text-gray-900 text-right max-w-[60%] truncate">
                          {strVal === 'true' ? (
                            <span className="inline-flex items-center gap-1 text-green-600">
                              <Check className="h-3.5 w-3.5" /> Sim
                            </span>
                          ) : strVal === 'false' ? (
                            <span className="text-gray-400">Não</span>
                          ) : (
                            strVal
                          )}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </SectionCard>

              {/* ── Timeline ── */}
              <SectionCard icon={Clock} title="Timeline">
                <LeadTimeline events={lead.events} />
              </SectionCard>
            </div>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
