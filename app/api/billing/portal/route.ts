import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateWorkspace } from '@/lib/db/queries/workspace'
import { stripe } from '@/lib/stripe/client'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getOrCreateWorkspace(user.id, user.email ?? '')

  if (!workspace.stripe_customer_id) {
    return NextResponse.json({ error: 'Nenhuma assinatura encontrada' }, { status: 400 })
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: workspace.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
  })

  return NextResponse.json({ url: session.url })
}
