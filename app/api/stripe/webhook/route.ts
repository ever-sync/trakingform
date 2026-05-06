import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { workspaces } from '@/lib/db/schema'
import { getStripe } from '@/lib/stripe/client'
import { planFromStripePriceId } from '@/lib/stripe/plans'
import type { Plan } from '@/types'

export const dynamic = 'force-dynamic'

function priceIdFromSubscription(sub: Stripe.Subscription): string | null {
  const item = sub.items.data[0]
  if (!item?.price) return null
  return typeof item.price === 'string' ? item.price : item.price.id
}

async function syncWorkspaceFromSubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
  if (!customerId) return { ok: false as const }

  const billingOk =
    sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due'
  const ended =
    sub.status === 'canceled' ||
    sub.status === 'unpaid' ||
    sub.status === 'incomplete_expired'

  if (!(billingOk || ended)) {
    return { ok: true as const, skipped: true as const }
  }

  let plan: Plan = 'starter'
  let stripeSubId: string | null = sub.id

  if (billingOk) {
    const priceId = priceIdFromSubscription(sub)
    plan = planFromStripePriceId(priceId) ?? 'starter'
  } else {
    stripeSubId = null
  }

  await db
    .update(workspaces)
    .set({
      plan,
      stripe_subscription_id: stripeSubId,
      updated_at: new Date(),
    })
    .where(eq(workspaces.stripe_customer_id, customerId))

  return { ok: true as const }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const workspaceId = session.metadata?.workspace_id ?? session.client_reference_id
  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id

  if (!workspaceId || !subscriptionId) return

  let sub: Stripe.Subscription
  try {
    sub = await getStripe().subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price'],
    })
  } catch {
    return
  }

  const priceId = priceIdFromSubscription(sub)
  const plan = planFromStripePriceId(priceId) ?? 'starter'

  await db
    .update(workspaces)
    .set({
      plan,
      stripe_subscription_id: subscriptionId,
      updated_at: new Date(),
    })
    .where(eq(workspaces.id, workspaceId))
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'STRIPE_WEBHOOK_SECRET não configurado' }, { status: 500 })
  }

  let stripe: ReturnType<typeof getStripe>
  try {
    stripe = getStripe()
  } catch {
    return NextResponse.json({ error: 'Stripe não configurado' }, { status: 500 })
  }

  const rawBody = await req.text()
  const sig = req.headers.get('stripe-signature')
  if (!sig) {
    return NextResponse.json({ error: 'Assinatura ausente' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret)
  } catch {
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode === 'subscription') {
          await handleCheckoutCompleted(session)
        }
        break
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await syncWorkspaceFromSubscription(sub)
        break
      }
      default:
        break
    }
  } catch (err) {
    console.error('[stripe/webhook]', event.type, err)
    return NextResponse.json({ error: 'Falha ao processar evento' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
