'use client'

import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface DailyLead {
  date: string
  leads: number
}

interface ScoreBucket {
  range: string
  count: number
}

interface FormStat {
  name: string
  leads: number
  views: number
}

interface Props {
  dailyLeads: DailyLead[]
  scoreBuckets: ScoreBucket[]
  formStats: FormStat[]
}

export function AnalyticsCharts({ dailyLeads, scoreBuckets, formStats }: Props) {
  const hasLeads = dailyLeads.some(d => d.leads > 0)
  const hasScores = scoreBuckets.some(b => b.count > 0)
  const hasForms = formStats.some(f => f.leads > 0)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leads nos últimos 30 dias</CardTitle>
        </CardHeader>
        <CardContent>
          {!hasLeads ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
              Nenhum lead no período.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={dailyLeads} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={4} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="leads"
                  stroke="#6366f1"
                  fill="url(#colorLeads)"
                  strokeWidth={2}
                  name="Leads"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição de score</CardTitle>
          </CardHeader>
          <CardContent>
            {!hasScores ? (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                Nenhum dado disponível.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={scoreBuckets} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366f1" name="Leads" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance por formulário</CardTitle>
          </CardHeader>
          <CardContent>
            {!hasForms ? (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                Nenhum dado disponível.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={formStats} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip />
                  <Bar dataKey="leads" fill="#6366f1" name="Leads" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
