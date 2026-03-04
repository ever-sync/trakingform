'use client'

import { useState, useEffect } from 'react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { LeadTimeline } from './LeadTimeline'
import { ScoreBreakdown } from './ScoreBreakdown'
import { Globe, Monitor, Clock, ExternalLink, Loader2 } from 'lucide-react'

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

function getScoreColor(score: number) {
  if (score >= 70) return 'bg-green-100 text-green-700'
  if (score >= 40) return 'bg-yellow-100 text-yellow-700'
  return 'bg-gray-100 text-gray-700'
}

function getScoreLabel(score: number) {
  if (score >= 70) return 'Quente'
  if (score >= 40) return 'Morno'
  return 'Frio'
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

  return (
    <Drawer open={!!leadId} onClose={onClose}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle>Detalhes do Lead</DrawerTitle>
        </DrawerHeader>

        <div className="overflow-y-auto px-4 pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : lead ? (
            <div className="space-y-5">
              {/* Header info */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">
                    {String(lead.data.name || lead.data.nome || 'Lead sem nome')}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {String(lead.data.email || '-')}
                  </p>
                  {lead.form_name && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Formulário: {lead.form_name}
                    </p>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <Badge variant="secondary">{lead.status}</Badge>
                  <Badge className={getScoreColor(lead.score)}>
                    {lead.score} - {getScoreLabel(lead.score)}
                  </Badge>
                  {lead.is_duplicate && <Badge variant="outline">Duplicado</Badge>}
                </div>
              </div>

              <ScoreBreakdown score={lead.score} factors={scoreFactors} />

              {/* UTM / Source */}
              {(lead.utm_source || lead.referrer) && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Origem</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {lead.utm_source && (
                        <div>
                          <span className="text-muted-foreground">Fonte:</span>{' '}
                          <span className="font-medium">{lead.utm_source}</span>
                        </div>
                      )}
                      {lead.utm_medium && (
                        <div>
                          <span className="text-muted-foreground">Meio:</span>{' '}
                          <span className="font-medium">{lead.utm_medium}</span>
                        </div>
                      )}
                      {lead.utm_campaign && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Campanha:</span>{' '}
                          <span className="font-medium">{lead.utm_campaign}</span>
                        </div>
                      )}
                      {lead.referrer && (
                        <div className="col-span-2 flex items-center gap-1">
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground truncate">{lead.referrer}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Enrichment */}
              {lead.enrichment && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Dispositivo & Localização</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {lead.enrichment.city && (
                        <div className="flex items-center gap-1.5">
                          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                          {lead.enrichment.city}, {lead.enrichment.region}
                        </div>
                      )}
                      {lead.enrichment.country && (
                        <div>{lead.enrichment.country}</div>
                      )}
                      {lead.enrichment.browser && (
                        <div className="flex items-center gap-1.5">
                          <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                          {lead.enrichment.browser} / {lead.enrichment.os}
                        </div>
                      )}
                      {lead.enrichment.device_type && (
                        <div className="capitalize">{lead.enrichment.device_type}</div>
                      )}
                      {lead.enrichment.is_vpn && (
                        <Badge variant="destructive" className="w-fit text-xs">VPN</Badge>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Time to complete */}
              {lead.time_to_complete_seconds && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Preencheu em {lead.time_to_complete_seconds}s
                </div>
              )}

              {/* Form data */}
              <Separator />
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Dados do formulário</h4>
                <div className="space-y-1.5">
                  {Object.entries(lead.data).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{key}</span>
                      <span className="font-medium text-right max-w-[60%] truncate">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Timeline */}
              <Separator />
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Timeline</h4>
                <LeadTimeline events={lead.events} />
              </div>
            </div>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
