import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { forms } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getOrCreateWorkspace } from '@/lib/db/queries/workspace'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, FileText } from 'lucide-react'
import { FormsCardsClient } from '@/components/forms/FormsCardsClient'

export default async function FormsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const workspace = await getOrCreateWorkspace(
    user.id,
    user.email ?? 'user@example.com',
    user.user_metadata?.workspace_name as string | undefined,
  )

  const formList = await db
    .select()
    .from(forms)
    .where(eq(forms.workspace_id, workspace.id))
    .orderBy(desc(forms.created_at))

  const totalForms = formList.length
  const activeForms = formList.filter((form) => form.is_active).length
  const totalLeads = formList.reduce((sum, form) => sum + (form.total_submissions ?? 0), 0)
  const totalViews = formList.reduce((sum, form) => sum + (form.total_views ?? 0), 0)
  const avgConversion = totalViews > 0 ? ((totalLeads / totalViews) * 100).toFixed(1) : '0.0'

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-0 bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold">Formularios</h1>
              <p className="mt-1 text-sm text-indigo-100">
                Crie, publique e acompanhe a performance dos seus formularios de captura.
              </p>
            </div>
            <Button asChild className="bg-white text-indigo-700 hover:bg-indigo-50">
              <Link href="/forms/new">
                <Plus className="mr-2 h-4 w-4" />
                Novo formulario
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Total de formularios</p>
            <p className="mt-1 text-2xl font-semibold">{totalForms}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Ativos</p>
            <p className="mt-1 text-2xl font-semibold">{activeForms}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Leads capturados</p>
            <p className="mt-1 text-2xl font-semibold">{totalLeads}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Conversao media</p>
            <p className="mt-1 text-2xl font-semibold">{avgConversion}%</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Seus formularios</h2>
          <p className="text-sm text-muted-foreground">Clique em um formulario para editar ou ver detalhes.</p>
        </div>
      </div>

      {formList.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50">
              <FileText className="h-6 w-6 text-indigo-600" />
            </div>
            <h3 className="mb-1 font-semibold text-gray-900">Nenhum formulario criado</h3>
            <p className="mb-4 max-w-sm text-center text-sm text-muted-foreground">
              Crie seu primeiro formulario para comecar a capturar leads com rastreamento e analise.
            </p>
            <Button asChild className="bg-indigo-600 hover:bg-indigo-700">
              <Link href="/forms/new">
                <Plus className="mr-2 h-4 w-4" />
                Criar formulario
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <FormsCardsClient
          initialForms={formList.map((form) => ({
            id: form.id,
            name: form.name,
            description: form.description,
            is_active: form.is_active,
            total_submissions: form.total_submissions,
            total_views: form.total_views,
            created_at: form.created_at ? new Date(form.created_at).toISOString() : null,
          }))}
        />
      )}
    </div>
  )
}
