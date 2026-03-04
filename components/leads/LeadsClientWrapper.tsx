'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { FileText, ExternalLink, Loader2 } from 'lucide-react'
import { LeadDetailDrawer } from './LeadDetailDrawer'
import { ScoreBreakdown } from './ScoreBreakdown'

interface LeadRow {
  id: string
  name: string
  email: string
  phone: string
  status: string
  score: number
  is_duplicate: boolean
  form_name: string
  utm_source: string | null
  created_at: string
}

interface ScoreFactor {
  name: string
  impact: number
  description: string
}

function getScoreColor(score: number) {
  if (score >= 70) return 'bg-green-100 text-green-700'
  if (score >= 40) return 'bg-yellow-100 text-yellow-700'
  return 'bg-gray-100 text-gray-600'
}

function extractScoreFactors(events: unknown): ScoreFactor[] {
  if (!Array.isArray(events)) return []
  const scoreEvent = events.find((event) => {
    if (!event || typeof event !== 'object' || Array.isArray(event)) return false
    return (event as { type?: unknown }).type === 'score_updated'
  }) as { metadata?: unknown } | undefined

  if (!scoreEvent?.metadata || typeof scoreEvent.metadata !== 'object' || Array.isArray(scoreEvent.metadata)) {
    return []
  }

  const metadata = scoreEvent.metadata as { factors?: unknown }
  if (!Array.isArray(metadata.factors)) return []

  return metadata.factors.filter((factor): factor is ScoreFactor => {
    if (!factor || typeof factor !== 'object' || Array.isArray(factor)) return false
    const candidate = factor as Record<string, unknown>
    return (
      typeof candidate.name === 'string' &&
      typeof candidate.impact === 'number' &&
      typeof candidate.description === 'string'
    )
  })
}

export function LeadsClientWrapper({ leads }: { leads: LeadRow[] }) {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [loadingScoreLeadId, setLoadingScoreLeadId] = useState<string | null>(null)
  const [scoreFactorsByLead, setScoreFactorsByLead] = useState<Record<string, ScoreFactor[]>>({})

  async function loadScoreFactors(leadId: string) {
    if (scoreFactorsByLead[leadId] || loadingScoreLeadId === leadId) return

    setLoadingScoreLeadId(leadId)
    try {
      const res = await fetch(`/api/leads/${leadId}`)
      if (!res.ok) return
      const data = await res.json()
      setScoreFactorsByLead((prev) => ({
        ...prev,
        [leadId]: extractScoreFactors(data.events),
      }))
    } catch (error) {
      console.error(error)
    } finally {
      setLoadingScoreLeadId((current) => (current === leadId ? null : current))
    }
  }

  return (
    <>
      <div className="space-y-3">
        {leads.map((lead) => (
          <Card
            key={lead.id}
            className="cursor-pointer transition-shadow hover:shadow-md"
            onClick={() => setSelectedLeadId(lead.id)}
          >
            <CardContent className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{lead.name}</h3>
                    <Badge variant="secondary">{lead.status}</Badge>
                    {lead.is_duplicate && <Badge variant="outline">Duplicado</Badge>}
                    {lead.utm_source && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <ExternalLink className="h-2.5 w-2.5" />
                        {lead.utm_source}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{lead.email}</p>
                  <p className="text-sm text-gray-600">{lead.phone}</p>
                </div>

                <div className="space-y-1 text-right text-xs text-gray-500">
                  <p className="inline-flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    {lead.form_name}
                  </p>
                  <p>
                    Score:{' '}
                    <Popover onOpenChange={(open) => { if (open) void loadScoreFactors(lead.id) }}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${getScoreColor(lead.score)}`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          {lead.score}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80" onClick={(event) => event.stopPropagation()}>
                        {loadingScoreLeadId === lead.id ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Carregando fatores...
                          </div>
                        ) : (
                          <ScoreBreakdown score={lead.score} factors={scoreFactorsByLead[lead.id] ?? []} />
                        )}
                      </PopoverContent>
                    </Popover>
                  </p>
                  <p>{lead.created_at}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <LeadDetailDrawer
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
      />
    </>
  )
}
