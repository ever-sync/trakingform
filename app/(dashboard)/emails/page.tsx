import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { emailCampaigns, emailTemplates } from '@/lib/db/schema'
import { getOrCreateWorkspace } from '@/lib/db/queries/workspace'
import { eq, desc } from 'drizzle-orm'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Mail } from 'lucide-react'
import { EmailTemplatesClient } from '@/components/emails/EmailTemplatesClient'
import { EmailCampaignsClient } from '@/components/emails/EmailCampaignsClient'

export const dynamic = 'force-dynamic'

export default async function EmailsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workspace = await getOrCreateWorkspace(
    user.id,
    user.email ?? 'user@example.com',
    user.user_metadata?.workspace_name as string | undefined,
  )

  const [templates, campaigns] = await Promise.all([
    db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.workspace_id, workspace.id))
      .orderBy(desc(emailTemplates.created_at)),
    db
      .select()
      .from(emailCampaigns)
      .where(eq(emailCampaigns.workspace_id, workspace.id))
      .orderBy(desc(emailCampaigns.created_at)),
  ])

  const serialized = templates.map(t => ({
    id: t.id,
    name: t.name,
    subject: t.subject,
    blocks: t.blocks,
    from_email: t.from_email,
    from_name: t.from_name,
    created_at: t.created_at ? new Date(t.created_at).toLocaleDateString('pt-BR') : '-',
  }))

  const serializedCampaigns = campaigns.map((campaign) => ({
    ...campaign,
    created_at: campaign.created_at ? new Date(campaign.created_at).toISOString() : null,
    template: templates.find((template) => template.id === campaign.template_id)
      ? {
          id: campaign.template_id!,
          name: templates.find((template) => template.id === campaign.template_id)?.name ?? '-',
          subject: templates.find((template) => template.id === campaign.template_id)?.subject ?? '-',
        }
      : null,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">E-mails</h1>
          <p className="text-muted-foreground">Templates e campanhas de e-mail</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/workspace/email">Configurar envio</Link>
          </Button>
          <Button asChild className="bg-indigo-600 hover:bg-indigo-700">
            <Link href="/emails/new">
              <Plus className="mr-2 h-4 w-4" />
              Novo template
            </Link>
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <EmailCampaignsClient
          templates={serialized.map((template) => ({ id: template.id, name: template.name }))}
          campaigns={serializedCampaigns}
        />

        {serialized.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50">
                <Mail className="h-6 w-6 text-indigo-600" />
              </div>
              <h3 className="mb-1 font-semibold text-gray-900">Nenhum template criado</h3>
              <p className="mb-4 max-w-sm text-center text-sm text-muted-foreground">
                Crie templates de e-mail para nutrir seus leads automaticamente.
              </p>
              <Button asChild className="bg-indigo-600 hover:bg-indigo-700">
                <Link href="/emails/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Criar template
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <EmailTemplatesClient templates={serialized} />
        )}
      </div>
    </div>
  )
}
