import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { leadConsents } from '@/lib/db/schema'
import { getOrCreateWorkspace } from '@/lib/db/queries/workspace'
import { desc, eq } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function CompliancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workspace = await getOrCreateWorkspace(user.id, user.email ?? 'user@example.com')

  const rows = await db
    .select()
    .from(leadConsents)
    .where(eq(leadConsents.workspace_id, workspace.id))
    .orderBy(desc(leadConsents.created_at))
    .limit(100)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Compliance LGPD</h1>
        <p className="text-muted-foreground">Trilhas de consentimento registradas para auditoria.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Consentimentos ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum consentimento registrado ainda.</p>
          ) : rows.map((row) => (
            <div key={row.id} className="rounded border p-2.5 text-xs">
              <p><strong>Lead:</strong> {row.lead_id}</p>
              <p><strong>Chave:</strong> {row.consent_key} ({row.consent_version})</p>
              <p><strong>Status:</strong> {row.granted ? 'Aceito' : 'Negado'}</p>
              <p><strong>Data:</strong> {row.created_at ? new Date(row.created_at).toLocaleString('pt-BR') : '-'}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

