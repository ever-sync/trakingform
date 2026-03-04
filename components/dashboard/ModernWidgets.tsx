'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from 'recharts'
import { MoreHorizontal, ArrowUpRight, Briefcase, Video } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

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
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-primary" /> Qualificados</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-emerald-500" /> Convertidos</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-amber-400" /> Pendentes</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-rose-500" /> Perdidos</div>
        </div>
        <div className="h-[180px] w-[180px] relative mt-4">
           {/* We use a mocked SVG for exact visual match of the thick glowing donut in the reference */}
           <svg viewBox="0 0 100 50" className="w-full h-full overflow-visible">
              <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#f3f4f6" strokeWidth="16" strokeLinecap="round" />
              <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="url(#gradient)" strokeWidth="16" strokeLinecap="round" strokeDasharray={`${(percentage/100) * 125} 125`} />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="30%" stopColor="#6366f1" />
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

// 2. Recent Leads List (Payroll style)
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
          {leads.map((lead) => (
            <div key={lead.id} className="flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border border-gray-100 shadow-sm">
                  <AvatarFallback className="bg-indigo-50 text-indigo-700 font-semibold text-xs">
                    {lead.name.slice(0,2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-bold text-gray-900 group-hover:text-primary transition-colors cursor-pointer">{lead.name}</p>
                  <p className="text-xs text-gray-400 font-medium">#{lead.id.slice(0,6)}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <span className="text-sm font-bold text-gray-900">{lead.score} pts</span>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${
                  lead.status === 'new' ? 'bg-indigo-50 text-indigo-600' :
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

// 3. Line Chart (Performance statistics style)
export function PerformanceChart({ data }: { data: Record<string, string | number>[] }) {
  return (
    <Card className="rounded-3xl shadow-sm border-gray-100 flex flex-col h-full col-span-1 lg:col-span-2 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 delay-150 animate-in fade-in slide-in-from-bottom-4 fill-mode-both">
      <CardHeader className="flex flex-row items-center justify-between pb-6">
        <div>
          <CardTitle className="text-base font-bold text-gray-900">Evolução de Captação</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Visão geral dos últimos 7 dias</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"/> Orgânico</span>
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-primary"/> Google Ads</span>
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-400"/> Meta Ads</span>
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-rose-500"/> Direto</span>
          </div>
          <select className="text-xs font-semibold bg-gray-50 border-none rounded-lg px-3 py-1.5 cursor-pointer outline-none focus:ring-2 focus:ring-primary/20">
            <option>Last 7 Days</option>
            <option>Last 30 Days</option>
          </select>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-[250px] w-full pb-0 pl-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 600 }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 600 }} tickFormatter={(val) => val + '%'} />
            <RechartsTooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              itemStyle={{ fontWeight: 600, fontSize: '13px' }}
            />
            <Line type="monotone" dataKey="organic" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} />
            <Line type="monotone" dataKey="google" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: 'white' }} activeDot={{ r: 6, strokeWidth: 0 }} />
            <Line type="monotone" dataKey="meta" stroke="#f59e0b" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} />
            <Line type="monotone" dataKey="direct" stroke="#ef4444" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// 4. Current Vacancies (Top Forms)
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
          {forms.map((form, i) => (
            <div key={i} className="flex items-center justify-between group cursor-pointer hover:bg-gray-50 p-2 -mx-2 rounded-xl transition-colors">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  i === 0 ? 'bg-primary/10 text-primary' : 
                  i === 1 ? 'bg-emerald-100 text-emerald-600' : 
                  'bg-rose-100 text-rose-600'
                }`}>
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{form.name}</p>
                  <p className="text-xs text-gray-400 font-medium">{form.submissions} Submissões • {form.conversion}% Tx</p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-primary transition-colors" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// 5. Segmented Progress Bar (Employment Status)
export function PipelineStatusWidget({ total, newCount, contacted, qualified }: { total: number, newCount: number, contacted: number, qualified: number }) {
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
          <div className="h-full bg-emerald-500 rounded-l-full relative group" style={{ width: pNew + '%' }}>
            <div className="absolute top-10 left-1/2 -translate-x-1/2 text-emerald-600 font-bold text-[11px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{Math.round(pNew)}%</div>
          </div>
          <div className="h-full bg-primary relative group" style={{ width: pContacted + '%' }}>
             <div className="absolute top-10 left-1/2 -translate-x-1/2 text-primary font-bold text-[11px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{Math.round(pContacted)}%</div>
          </div>
          <div className="h-full bg-amber-400 rounded-r-full relative group" style={{ width: pQualified + '%' }}>
             <div className="absolute top-10 left-1/2 -translate-x-1/2 text-amber-500 font-bold text-[11px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{Math.round(pQualified)}%</div>
          </div>
        </div>

        <div className="flex justify-between text-xs font-bold text-gray-900">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500" /> Novos ({newCount})</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-primary" /> Contatados ({contacted})</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-400" /> Qualificados ({qualified})</div>
        </div>
        
        <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-4">
           <div className="flex items-center gap-2">
             <span className="text-sm font-bold text-gray-900">Equipe Online</span>
             <div className="flex -space-x-2">
               <Avatar className="h-8 w-8 border-2 border-white"><AvatarFallback className="bg-primary text-white text-xs">A</AvatarFallback></Avatar>
               <Avatar className="h-8 w-8 border-2 border-white"><AvatarFallback className="bg-emerald-500 text-white text-xs">B</AvatarFallback></Avatar>
               <Avatar className="h-8 w-8 border-2 border-white"><AvatarFallback className="bg-amber-400 text-white text-xs">C</AvatarFallback></Avatar>
               <Avatar className="h-8 w-8 border-2 border-white"><AvatarFallback className="bg-rose-500 text-white text-xs">D</AvatarFallback></Avatar>
             </div>
           </div>
           <span className="text-sm font-bold text-gray-900 pr-2">4 Pessoas</span>
        </div>
      </CardContent>
    </Card>
  )
}

// 6. Action List (Meetings/Events)
export function FollowUpList() {
  const followups: { name: string; role: string; time: string; platform: string }[] = [
    { name: 'Wade Warren', role: 'Qualificado', time: '8:00 - 8:45 AM', platform: 'Zoom' },
    { name: 'Jane Cooper', role: 'Novo Lead', time: '12:30 - 1:15 PM', platform: 'Meet' },
    { name: 'Courtney Henry', role: 'Retorno', time: '3:00 - 4:45 PM', platform: 'Call' },
  ]
  return (
    <Card className="rounded-3xl shadow-sm border-gray-100 flex flex-col h-full hover:shadow-lg hover:-translate-y-1 transition-all duration-300 delay-500 animate-in fade-in slide-in-from-bottom-4 fill-mode-both">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="text-base font-bold text-gray-900">Follow-ups</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Reuniões importantes agendadas</p>
        </div>
        <select className="text-xs font-semibold bg-gray-50 border-none rounded-lg px-2 py-1 cursor-pointer outline-none">
          <option>Hoje</option>
          <option>Amanhã</option>
        </select>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        {followups.map((item, i) => (
          <div key={i} className="flex flex-col gap-3 p-4 rounded-2xl bg-gray-50/50 border border-gray-100">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-sm text-gray-900">Com {item.name}</p>
                <p className="text-xs text-gray-500 font-medium mt-0.5">{item.time}</p>
              </div>
              <span className="text-[10px] font-bold bg-white px-2 py-1 rounded shadow-sm border border-gray-100">{item.role}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex -space-x-1.5">
                <Avatar className="h-6 w-6 border-2 border-white"><AvatarFallback className="bg-primary text-white text-[10px]">{item.name[0]}</AvatarFallback></Avatar>
                <Avatar className="h-6 w-6 border-2 border-white"><AvatarFallback className="bg-gray-200 text-gray-600 text-[10px]">Yu</AvatarFallback></Avatar>
              </div>
              <Button size="sm" className="h-7 text-[11px] font-bold rounded-full bg-emerald-500 hover:bg-emerald-600 px-4">
                <Video className="w-3 h-3 mr-1.5" /> Entrar
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
