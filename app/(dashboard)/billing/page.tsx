import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check } from 'lucide-react'
import { PLAN_PRICES_BRL } from '@/lib/stripe/plans'

const plans = [
  {
    name: 'Starter',
    key: 'starter' as const,
    description: 'Para quem está começando',
    features: ['3 formulários', '500 leads/mês', '1 workspace', '3 templates de e-mail', '1 webhook'],
  },
  {
    name: 'Pro',
    key: 'pro' as const,
    description: 'Para equipes em crescimento',
    popular: true,
    features: ['Formulários ilimitados', '5.000 leads/mês', '5 workspaces', 'Templates ilimitados', '10 webhooks', 'Lead scoring', 'API access'],
  },
  {
    name: 'Agency',
    key: 'agency' as const,
    description: 'Para agências e grandes times',
    features: ['Tudo do Pro', 'Leads ilimitados', 'Workspaces ilimitados', 'White-label', 'Domínio customizado'],
  },
]

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Plano & Faturamento</h1>
        <p className="text-muted-foreground">Gerencie sua assinatura</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plano atual</CardTitle>
          <CardDescription>Você está no plano <strong>Starter</strong></CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">Starter</Badge>
            <span className="text-sm text-muted-foreground">0 / 500 leads este mês</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <Card key={plan.key} className={plan.popular ? 'border-indigo-600 shadow-md' : ''}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{plan.name}</CardTitle>
                {plan.popular && <Badge className="bg-indigo-600">Popular</Badge>}
              </div>
              <CardDescription>{plan.description}</CardDescription>
              <div className="text-2xl font-bold">
                R$ {PLAN_PRICES_BRL[plan.key]}
                <span className="text-sm font-normal text-muted-foreground">/mês</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                className={`w-full ${plan.popular ? 'bg-indigo-600 hover:bg-indigo-700' : ''}`}
                variant={plan.popular ? 'default' : 'outline'}
              >
                {plan.key === 'starter' ? 'Plano atual' : `Assinar ${plan.name}`}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
