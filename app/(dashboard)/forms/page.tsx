import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { forms } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getOrCreateWorkspace } from '@/lib/db/queries/workspace'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, FileText, Users, BarChart2, TrendingUp, CalendarDays } from 'lucide-react'

function formatDate(value: unknown) {
  if (!value) return '-'
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('pt-BR')
}

export default async function FormsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const workspace = await getOrCreateWorkspace(user.id, user.email ?? 'user@example.com')

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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {formList.map((form) => {
            const views = form.total_views ?? 0
            const submissions = form.total_submissions ?? 0
            const conversion = views > 0 ? ((submissions / views) * 100).toFixed(1) : '0.0'

            return (
              <Card key={form.id} className="group border-gray-200 transition-all hover:-translate-y-0.5 hover:shadow-lg">
                <CardContent className="pt-5">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="min-w-0 flex-1 pr-2">
                      <h3 className="truncate font-semibold text-gray-900">{form.name}</h3>
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Criado em {formatDate(form.created_at)}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={
                        form.is_active
                          ? 'shrink-0 bg-green-100 text-green-700'
                          : 'shrink-0 bg-gray-100 text-gray-500'
                      }
                    >
                      {form.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>

                  {form.description && (
                    <p className="mb-3 text-sm text-muted-foreground">
                      {form.description.length > 96 ? `${form.description.slice(0, 96)}...` : form.description}
                    </p>
                  )}

                  <div className="mb-4 grid grid-cols-3 gap-2 rounded-lg border border-gray-100 bg-gray-50 p-2.5 text-xs">
                    <div className="space-y-0.5">
                      <p className="text-muted-foreground">Leads</p>
                      <p className="font-semibold text-gray-900">{submissions}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-muted-foreground">Visitas</p>
                      <p className="font-semibold text-gray-900">{views}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-muted-foreground">Conversao</p>
                      <p className="font-semibold text-gray-900">{conversion}%</p>
                    </div>
                  </div>

                  <div className="mb-4 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {submissions} leads
                    </span>
                    <span className="flex items-center gap-1">
                      <BarChart2 className="h-3.5 w-3.5" />
                      {views} visitas
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5" />
                      {conversion}%
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" asChild className="flex-1">
                      <Link href={`/forms/${form.id}/edit`}>Editar</Link>
                    </Button>
                    <Button size="sm" asChild className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                      <Link href={`/forms/${form.id}`}>Detalhes</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
