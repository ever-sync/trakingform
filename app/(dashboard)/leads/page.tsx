import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LeadsClientWrapper } from '@/components/leads/LeadsClientWrapper'

export default async function LeadsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
        <p className="text-muted-foreground">Explore, filtre e acompanhe todos os cadastros em tempo real.</p>
      </div>

      <LeadsClientWrapper />
    </div>
  )
}
