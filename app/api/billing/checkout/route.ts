import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { workspaces } from '@/lib/db/schema'
import { getOrCreateWorkspace } from '@/lib/db/queries/workspace'
import { eq } from 'drizzle-orm'
import { stripe } from '@/lib/stripe/client'
import { STRIPE_PRICE_IDS } from '@/lib/stripe/plans'
import type { Plan } from '@/types'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { plan: Plan }
  const { plan } = body
  if (!plan || !['starter', 'pro', 'agency'].includes(plan)) {
    return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })
  }

  const workspace = await getOrCreateWorkspace(user.id, user.email ?? '')
  const priceId = STRIPE_PRICE_IDS[plan]
  if (!priceId) {
    return NextResponse.json({ error: 'Price ID não configurado para este plano' }, { status: 500 })
  }

  let customerId = workspace.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email!,
      metadata: { workspace_id: workspace.id, user_id: user.id },
    })
    customerId = customer.id
    await db.update(workspaces)
      .set({ stripe_customer_id: customerId })
      .where(eq(workspaces.id, workspace.id))
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
    metadata: { workspace_id: workspace.id },
    client_reference_id: workspace.id,
  })

  return NextResponse.json({ url: session.url })
}
