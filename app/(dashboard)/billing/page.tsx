import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateWorkspace } from '@/lib/db/queries/workspace'
import { PLAN_PRICES_BRL, PLANS } from '@/lib/stripe/plans'
import { BillingClient } from '@/components/billing/BillingClient'
import type { Plan } from '@/types'

export const dynamic = 'force-dynamic'

const plans = [
  {
    name: 'Starter',
    key: 'starter' as Plan,
    description: 'Para quem está começando',
    features: ['3 formulários', '500 leads/mês', '1 workspace', '3 templates de e-mail', '1 webhook'],
  },
  {
    name: 'Pro',
    key: 'pro' as Plan,
    description: 'Para equipes em crescimento',
    popular: true,
    features: ['Formulários ilimitados', '5.000 leads/mês', '5 workspaces', 'Templates ilimitados', '10 webhooks', 'Lead scoring', 'API access'],
  },
  {
    name: 'Agency',
    key: 'agency' as Plan,
    description: 'Para agências e grandes times',
    features: ['Tudo do Pro', 'Leads ilimitados', 'Workspaces ilimitados', 'White-label', 'Domínio customizado'],
  },
]

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workspace = await getOrCreateWorkspace(
    user.id,
    user.email ?? 'user@example.com',
    user.user_metadata?.workspace_name as string | undefined,
  )

  const currentPlan = (workspace.plan ?? 'starter') as Plan
  const leadsUsed = workspace.leads_used_this_month ?? 0
  const leadsLimit = PLANS[currentPlan].maxLeadsPerMonth
  const hasSubscription = !!workspace.stripe_customer_id

  return (
    <BillingClient
      plans={plans}
      currentPlan={currentPlan}
      leadsUsed={leadsUsed}
      leadsLimit={leadsLimit}
      hasSubscription={hasSubscription}
      planPrices={PLAN_PRICES_BRL}
    />
  )
}
