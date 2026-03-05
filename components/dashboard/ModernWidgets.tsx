'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from 'recharts'
import { MoreHorizontal, ArrowUpRight, Briefcase, Clock, ArrowRight } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

// 1. Conversion Gauge
export function ConversionGauge({ percentage, total }: { percentage: number, total: number }) {
  return (
    <Card className="rounded-3xl shadow-sm border-gray-100 flex flex-col h-full hover:shadow-lg hover:-translate-y-1 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 relative overflow-hidden group">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base font-bold text-gray-900">Taxa de Conversão</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Visitas vs Submissões em tempo real</p>
        </div>
        <button className="text-gray-400 hover:text-gray-600"><MoreHorizontal className="w-5 h-5" /></button>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col items-center justify-center pt-2 relative">
        <div className="flex gap-4 text-xs font-semibold mb-2 w-full justify-center">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-gray-900" /> Qualificados</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-emerald-500" /> Convertidos</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-amber-400" /> Pendentes</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-rose-500" /> Perdidos</div>
        </div>
        <div className="h-[180px] w-[180px] relative mt-4">
           <svg viewBox="0 0 100 50" className="w-full h-full overflow-visible">
              <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#f3f4f6" strokeWidth="16" strokeLinecap="round" />
              <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="url(#gradient)" strokeWidth="16" strokeLinecap="round" strokeDasharray={`${(percentage/100) * 125} 125`} />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#333333" />
                  <stop offset="30%" stopColor="#000000" />
                  <stop offset="70%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
              </defs>
           </svg>
           <div className="absolute top-[80px] left-1/2 -translate-x-1/2 text-center w-full">
              <span className="text-3xl font-extrabold text-gray-900">{total} <span className="text-xl text-gray-500 font-semibold">({percentage}%)</span></span>
           </div>
        </div>
      </CardContent>
    </Card>
  )
}

// 2. Recent Leads List
interface LeadItem {
  id: string
  name: string
  score: number
  status: string
}
export function RecentLeadsList({ leads }: { leads: LeadItem[] }) {
  return (
    <Card className="rounded-3xl shadow-sm border-gray-100 flex flex-col h-full hover:shadow-lg hover:-translate-y-1 transition-all duration-300 delay-75 animate-in fade-in slide-in-from-bottom-4 fill-mode-both relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="text-base font-bold text-gray-900">Últimos Leads</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Acompanhe os leads recentes</p>
        </div>
        <button className="text-gray-400 hover:text-gray-600"><MoreHorizontal className="w-5 h-5" /></button>
      </CardHeader>
      <CardContent className="flex-1 px-4 pb-4">
        <div className="space-y-4">
          {leads.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">Nenhum lead ainda</p>
          )}
          {leads.map((lead) => (
            <div key={lead.id} className="flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border border-gray-100 shadow-sm">
                  <AvatarFallback className="bg-gray-100 text-gray-900 font-semibold text-xs">
                    {lead.name.slice(0,2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-bold text-gray-900 group-hover:text-gray-600 transition-colors cursor-pointer">{lead.name}</p>
                  <p className="text-xs text-gray-400 font-medium">#{lead.id.slice(0,6)}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <span className="text-sm font-bold text-gray-900">{lead.score} pts</span>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${
                  lead.status === 'new' ? 'bg-gray-100 text-black' :
                  lead.status === 'qualified' ? 'bg-emerald-50 text-emerald-600' :
                  lead.status === 'converted' ? 'bg-emerald-50 text-emerald-600' :
                  'bg-rose-50 text-rose-600'
                }`}>
                  {lead.status === 'new' ? 'Novo' : lead.status === 'qualified' ? 'Qualificado' : lead.status === 'converted' ? 'Convertido' : 'Perdido'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// 3. Performance Chart
export function PerformanceChart({ data }: { data: Record<string, string | number>[] }) {
  return (
    <Card className="rounded-3xl shadow-sm border-gray-100 flex flex-col h-full col-span-1 lg:col-span-2 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 delay-150 animate-in fade-in slide-in-from-bottom-4 fill-mode-both">
      <CardHeader className="flex flex-row items-center justify-between pb-6">
        <div>
          <CardTitle className="text-base font-bold text-gray-900">Evolução de Captação</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Leads por fonte nos últimos 7 dias</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"/> Orgânico</span>
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-gray-900"/> Google Ads</span>
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-400"/> Meta Ads</span>
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-rose-500"/> Direto</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-[250px] w-full pb-0 pl-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 600 }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 600 }} allowDecimals={false} />
            <RechartsTooltip
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              itemStyle={{ fontWeight: 600, fontSize: '13px' }}
            />
            <Line type="monotone" dataKey="organic" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} name="Orgânico" />
            <Line type="monotone" dataKey="google" stroke="#111111" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: 'white' }} activeDot={{ r: 6, strokeWidth: 0 }} name="Google Ads" />
            <Line type="monotone" dataKey="meta" stroke="#f59e0b" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} name="Meta Ads" />
            <Line type="monotone" dataKey="direct" stroke="#ef4444" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} name="Direto" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// 4. Top Forms
interface FormStats {
  name: string
  submissions: number
  conversion: string
}
export function TopFormsWidget({ forms }: { forms: FormStats[] }) {
  return (
    <Card className="rounded-3xl shadow-sm border-gray-100 flex flex-col h-full hover:shadow-lg hover:-translate-y-1 transition-all duration-300 delay-200 animate-in fade-in slide-in-from-bottom-4 fill-mode-both">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="text-base font-bold text-gray-900">Top Formulários</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Maior volume de submissões</p>
        </div>
        <button className="text-gray-400 hover:text-gray-600"><MoreHorizontal className="w-5 h-5" /></button>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="space-y-4">
          {forms.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">Nenhum formulário</p>
          )}
          {forms.map((form, i) => (
            <div key={i} className="flex items-center justify-between group cursor-pointer hover:bg-gray-50 p-2 -mx-2 rounded-xl transition-colors">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  i === 0 ? 'bg-gray-900 text-white' :
                  i === 1 ? 'bg-gray-200 text-gray-700' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{form.name}</p>
                  <p className="text-xs text-gray-400 font-medium">{form.submissions} Submissões • {form.conversion}% Tx</p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-gray-900 transition-colors" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// 5. Pipeline Status
interface TeamMember {
  email: string
  initials: string
}
export function PipelineStatusWidget({ total, newCount, contacted, qualified, members }: {
  total: number
  newCount: number
  contacted: number
  qualified: number
  members: TeamMember[]
}) {
  const pNew = total > 0 ? (newCount / total) * 100 : 0
  const pContacted = total > 0 ? (contacted / total) * 100 : 0
  const pQualified = total > 0 ? (qualified / total) * 100 : 0

  return (
    <Card className="rounded-3xl shadow-sm border-gray-100 flex flex-col h-full col-span-1 lg:col-span-2 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 delay-300 animate-in fade-in slide-in-from-bottom-4 fill-mode-both">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="text-base font-bold text-gray-900">Status do Funil (Pipeline)</CardTitle>
        </div>
        <button className="text-gray-400 hover:text-gray-600"><MoreHorizontal className="w-5 h-5" /></button>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-center px-6">
        <div className="flex items-baseline gap-2 mb-6">
          <span className="text-4xl font-extrabold text-gray-900">{total}</span>
          <span className="text-sm font-semibold text-gray-400">Total Leads</span>
        </div>

        {/* Segmented Bar */}
        <div className="w-full h-8 rounded-full flex gap-1 mb-8">
          {pNew > 0 && (
            <div className="h-full bg-emerald-500 rounded-l-full relative group" style={{ width: pNew + '%' }}>
              <div className="absolute top-10 left-1/2 -translate-x-1/2 text-emerald-600 font-bold text-[11px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{Math.round(pNew)}%</div>
            </div>
          )}
          {pContacted > 0 && (
            <div className="h-full bg-gray-900 relative group" style={{ width: pContacted + '%' }}>
              <div className="absolute top-10 left-1/2 -translate-x-1/2 text-gray-900 font-bold text-[11px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{Math.round(pContacted)}%</div>
            </div>
          )}
          {pQualified > 0 && (
            <div className="h-full bg-amber-400 rounded-r-full relative group" style={{ width: pQualified + '%' }}>
              <div className="absolute top-10 left-1/2 -translate-x-1/2 text-amber-500 font-bold text-[11px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{Math.round(pQualified)}%</div>
            </div>
          )}
          {total === 0 && (
            <div className="h-full bg-gray-100 rounded-full w-full" />
          )}
        </div>

        <div className="flex justify-between text-xs font-bold text-gray-900">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500" /> Novos ({newCount})</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-gray-900" /> Contatados ({contacted})</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-400" /> Qualificados ({qualified})</div>
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-4">
           <div className="flex items-center gap-2">
             <span className="text-sm font-bold text-gray-900">Equipe</span>
             <div className="flex -space-x-2">
               {members.slice(0, 4).map((member, i) => (
                 <Avatar key={i} className="h-8 w-8 border-2 border-white">
                   <AvatarFallback className="bg-gray-900 text-white text-xs">{member.initials}</AvatarFallback>
                 </Avatar>
               ))}
               {members.length > 4 && (
                 <Avatar className="h-8 w-8 border-2 border-white">
                   <AvatarFallback className="bg-gray-200 text-gray-600 text-xs">+{members.length - 4}</AvatarFallback>
                 </Avatar>
               )}
             </div>
           </div>
           <span className="text-sm font-bold text-gray-900 pr-2">
             {members.length} {members.length === 1 ? 'Pessoa' : 'Pessoas'}
           </span>
        </div>
      </CardContent>
    </Card>
  )
}

// 6. Pending Leads (replaces Follow-ups)
interface PendingLead {
  id: string
  name: string
  score: number
  createdAt: string
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 60) return `há ${diffMin}min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `há ${diffH}h`
  const diffD = Math.floor(diffH / 24)
  return `há ${diffD}d`
}

export function PendingLeadsList({ leads }: { leads: PendingLead[] }) {
  return (
    <Card className="rounded-3xl shadow-sm border-gray-100 flex flex-col h-full hover:shadow-lg hover:-translate-y-1 transition-all duration-300 delay-500 animate-in fade-in slide-in-from-bottom-4 fill-mode-both">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="text-base font-bold text-gray-900">Leads Pendentes</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Aguardando primeiro contato</p>
        </div>
        <Link href="/leads" className="text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors">
          Ver todos
        </Link>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        {leads.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-gray-400">Nenhum lead pendente</p>
            <p className="text-xs text-gray-300 mt-1">Todos os leads foram contatados</p>
          </div>
        )}
        {leads.map((lead) => (
          <div key={lead.id} className="flex flex-col gap-3 p-4 rounded-2xl bg-gray-50/50 border border-gray-100">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-sm text-gray-900">{lead.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Clock className="w-3 h-3 text-gray-400" />
                  <p className="text-xs text-gray-500 font-medium">{timeAgo(lead.createdAt)}</p>
                </div>
              </div>
              <span className="text-[11px] font-bold bg-white px-2 py-1 rounded shadow-sm border border-gray-100">
                {lead.score} pts
              </span>
            </div>
            <div className="flex items-center justify-end">
              <Button size="sm" asChild className="h-7 text-[11px] font-bold rounded-full bg-gray-900 hover:bg-gray-800 px-4">
                <Link href={`/leads?id=${lead.id}`}>
                  Contatar <ArrowRight className="w-3 h-3 ml-1.5" />
                </Link>
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
