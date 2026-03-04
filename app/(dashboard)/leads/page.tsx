import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { forms, leads } from '@/lib/db/schema'
import { getOrCreateWorkspace } from '@/lib/db/queries/workspace'
import { desc, eq } from 'drizzle-orm'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Users, Search, Download } from 'lucide-react'
import { LeadsClientWrapper } from '@/components/leads/LeadsClientWrapper'

function extractContact(data: unknown) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { name: '-', email: '-', phone: '-' }
  }

  const record = data as Record<string, unknown>
  const name =
    (typeof record.name === 'string' && record.name.trim()) ||
    (typeof record.nome === 'string' && record.nome.trim()) ||
    (typeof record.full_name === 'string' && record.full_name.trim()) ||
    '-'

  const email = (typeof record.email === 'string' && record.email.trim()) || '-'
  const phone =
    (typeof record.phone === 'string' && record.phone.trim()) ||
    (typeof record.telefone === 'string' && record.telefone.trim()) ||
    '-'

  return { name, email, phone }
}
function extractUtmSource(data: unknown): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const record = data as Record<string, unknown>
  if (typeof record.utm_source === 'string' && record.utm_source.trim()) return record.utm_source.trim()
  if (typeof record._utm_source === 'string' && record._utm_source.trim()) return record._utm_source.trim()
  return null
}

export default async function LeadsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const workspace = await getOrCreateWorkspace(user.id, user.email ?? 'user@example.com')

  const leadRows = await db
    .select({
      id: leads.id,
      created_at: leads.created_at,
      status: leads.status,
      score: leads.score,
      is_duplicate: leads.is_duplicate,
      data: leads.data,
      form_name: forms.name,    })
    .from(leads)
    .leftJoin(forms, eq(leads.form_id, forms.id))
    .where(eq(leads.workspace_id, workspace.id))
    .orderBy(desc(leads.created_at))
    .limit(100)

  const leadsData = leadRows.map(lead => {
    const contact = extractContact(lead.data)
    return {
      id: lead.id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      status: lead.status ?? 'new',
      score: lead.score ?? 0,
      is_duplicate: lead.is_duplicate ?? false,
      form_name: lead.form_name ?? 'Formulário removido',
      utm_source: extractUtmSource(lead.data),
      created_at: lead.created_at ? new Date(lead.created_at).toLocaleString('pt-BR') : '-',
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-muted-foreground">Cadastros recebidos pelos seus formulários</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Busca rápida (em breve)" disabled />
        </div>
      </div>

      {leadsData.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50">
              <Users className="h-6 w-6 text-indigo-600" />
            </div>
            <h3 className="mb-1 font-semibold text-gray-900">Nenhum lead ainda</h3>
            <p className="max-w-sm text-center text-sm text-muted-foreground">
              Assim que alguém enviar um formulário, os dados vão aparecer aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <LeadsClientWrapper leads={leadsData} />
      )}
    </div>
  )
}

