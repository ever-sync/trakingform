'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Plan } from '@/types'

interface PlanDef {
  name: string
  key: Plan
  description: string
  popular?: boolean
  features: string[]
}

interface Props {
  plans: PlanDef[]
  currentPlan: string
  leadsUsed: number
  leadsLimit: number
  hasSubscription: boolean
  planPrices: Record<Plan, number>
}

export function BillingClient({ plans, currentPlan, leadsUsed, leadsLimit, hasSubscription, planPrices }: Props) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  async function handleSubscribe(planKey: Plan) {
    setLoadingPlan(planKey)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error(data.error ?? 'Erro ao criar sessão de pagamento')
      }
    } catch {
      toast.error('Erro ao processar pagamento')
    } finally {
      setLoadingPlan(null)
    }
  }

  async function handlePortal() {
    setLoadingPlan('portal')
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error(data.error ?? 'Erro ao abrir portal')
      }
    } catch {
      toast.error('Erro ao acessar portal de faturamento')
    } finally {
      setLoadingPlan(null)
    }
  }

  const leadsLimitDisplay = leadsLimit === Infinity ? '∞' : String(leadsLimit)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Plano & Faturamento</h1>
        <p className="text-muted-foreground">Gerencie sua assinatura</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plano atual</CardTitle>
          <CardDescription>
            Você está no plano <strong className="capitalize">{currentPlan}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="capitalize">{currentPlan}</Badge>
              <span className="text-sm text-muted-foreground">
                {leadsUsed} / {leadsLimitDisplay} leads este mês
              </span>
            </div>
            {hasSubscription && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePortal}
                disabled={loadingPlan === 'portal'}
              >
                {loadingPlan === 'portal' && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Gerenciar assinatura
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const isCurrent = plan.key === currentPlan
          const isLoading = loadingPlan === plan.key
          return (
            <Card key={plan.key} className={plan.popular ? 'border-black shadow-md' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  {plan.popular && <Badge className="bg-black">Popular</Badge>}
                </div>
                <CardDescription>{plan.description}</CardDescription>
                <div className="text-2xl font-bold">
                  R$ {planPrices[plan.key]}
                  <span className="text-sm font-normal text-muted-foreground">/mês</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full ${plan.popular && !isCurrent ? 'bg-black hover:bg-gray-800' : ''}`}
                  variant={plan.popular && !isCurrent ? 'default' : 'outline'}
                  disabled={isCurrent || isLoading}
                  onClick={() => { if (!isCurrent) void handleSubscribe(plan.key) }}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isCurrent ? 'Plano atual' : `Assinar ${plan.name}`}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
