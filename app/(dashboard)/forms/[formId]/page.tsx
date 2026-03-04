import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { emailTemplates, forms, leads, formVariants } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getOrCreateWorkspace } from '@/lib/db/queries/workspace'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Edit } from 'lucide-react'
import { QRCodeDialog } from '@/components/forms/QRCodeDialog'
import { UTMGenerator } from '@/components/forms/UTMGenerator'

function extractUtmSource(data: unknown): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const record = data as Record<string, unknown>
  if (typeof record.utm_source === 'string' && record.utm_source.trim()) return record.utm_source.trim()
  if (typeof record._utm_source === 'string' && record._utm_source.trim()) return record._utm_source.trim()
  return null
}

function parseAutoWinnerSettings(settings: unknown) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return { enabled: false, minDays: 7, minViews: 100, appliedAt: null as string | null }
  }

  const raw = (settings as Record<string, unknown>).abAutoWinner
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { enabled: false, minDays: 7, minViews: 100, appliedAt: null as string | null }
  }

  const cfg = raw as Record<string, unknown>
  const minDays = Number(cfg.minDays)
  const minViews = Number(cfg.minViews)

  return {
    enabled: !!cfg.enabled,
    minDays: Number.isFinite(minDays) ? Math.max(1, Math.min(365, Math.round(minDays))) : 7,
    minViews: Number.isFinite(minViews) ? Math.max(1, Math.min(1_000_000, Math.round(minViews))) : 100,
    appliedAt: typeof cfg.appliedAt === 'string' ? cfg.appliedAt : null,
  }
}

export default async function FormDetailPage({
  params,
}: {
  params: Promise<{ formId: string }>
}) {
  const { formId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const workspace = await getOrCreateWorkspace(
    user.id,
    user.email ?? 'user@example.com',
    user.user_metadata?.workspace_name as string | undefined,
  )

  const form = await db.query.forms.findFirst({
    where: eq(forms.id, formId),
  })

  if (!form || form.workspace_id !== workspace.id) notFound()

  const formLeads = await db
    .select({
      id: leads.id,
      data: leads.data,
      status: leads.status,
      score: leads.score,
      created_at: leads.created_at,
    })
    .from(leads)
    .where(eq(leads.form_id, formId))
    .orderBy(desc(leads.created_at))
    .limit(50)
  const variants = await db
    .select({
      id: formVariants.id,
      name: formVariants.name,
      total_views: formVariants.total_views,
      total_submissions: formVariants.total_submissions,
      weight: formVariants.weight,
      is_active: formVariants.is_active,
    })
    .from(formVariants)
    .where(eq(formVariants.form_id, formId))
    .orderBy(desc(formVariants.created_at))

  const emailTemplate = form.email_template_id
    ? await db
        .select({ id: emailTemplates.id, name: emailTemplates.name, subject: emailTemplates.subject })
        .from(emailTemplates)
        .where(eq(emailTemplates.id, form.email_template_id))
        .limit(1)
        .then((rows) => rows[0] ?? null)
    : null

  const conversionRate = (form.total_views ?? 0) > 0
    ? (((form.total_submissions ?? 0) / (form.total_views ?? 1)) * 100).toFixed(1)
    : '0.0'

  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const runtimeAppUrl = host ? `${proto}://${host}` : null
  const appUrl = runtimeAppUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const totalVariantViews = variants.reduce((sum, variant) => sum + (variant.total_views ?? 0), 0)
  const autoWinner = parseAutoWinnerSettings(form.settings)
  const minWinnerViews = autoWinner.minViews

  const variantStats = variants.map((variant) => {
    const views = variant.total_views ?? 0
    const leadsCount = variant.total_submissions ?? 0
    const conversion = views > 0 ? (leadsCount / views) * 100 : 0
    const trafficShare = totalVariantViews > 0 ? (views / totalVariantViews) * 100 : 0
    return { ...variant, views, leadsCount, conversion, trafficShare }
  })

  const winnerCandidate = variantStats
    .filter((variant) => (variant.is_active ?? true) && variant.views >= minWinnerViews)
    .sort((a, b) => {
      if (b.conversion !== a.conversion) return b.conversion - a.conversion
      return b.views - a.views
    })[0] ?? null

  const potentialWinner = winnerCandidate
    ? null
    : variantStats
        .filter((variant) => (variant.is_active ?? true) && variant.views > 0)
        .sort((a, b) => {
          if (b.conversion !== a.conversion) return b.conversion - a.conversion
          return b.views - a.views
        })[0] ?? null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/forms"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{form.name}</h1>
              <Badge variant="secondary" className={form.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                {form.is_active ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
            {form.description && <p className="text-muted-foreground text-sm">{form.description}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <QRCodeDialog formId={formId} formName={form.name} appUrl={appUrl} />
          <Button asChild className="bg-indigo-600 hover:bg-indigo-700">
            <Link href={`/forms/${formId}/edit`}>
              <Edit className="h-4 w-4 mr-2" />
              Editar formulário
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="leads">Leads ({formLeads.length})</TabsTrigger>
          <TabsTrigger value="embed">Embed</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total de visitas', value: String(form.total_views ?? 0) },
              { label: 'Submissões', value: String(form.total_submissions ?? 0) },
              { label: 'Conversão', value: `${conversionRate}%` },
            ].map(stat => (
              <Card key={stat.label}>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Template de e-mail</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {emailTemplate?.name ?? 'Sem template definido'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {emailTemplate?.subject ?? 'Configure um template para enviar e-mail automatico ao lead.'}
                </p>
              </div>
              <Button variant="outline" asChild>
                <Link href={`/forms/${formId}/edit`}>Editar formulario</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">A/B Testing</CardTitle>
            </CardHeader>
            <CardContent>
              {variants.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma variante criada ainda. Configure variantes no builder para acompanhar desempenho A/B.
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                    {autoWinner.enabled ? (
                      autoWinner.appliedAt ? (
                        <span>
                          Auto winner ativo (regra {autoWinner.minDays}d / {autoWinner.minViews} views). Aplicado em{' '}
                          {new Date(autoWinner.appliedAt).toLocaleString('pt-BR')}.
                        </span>
                      ) : (
                        <span>Auto winner ativo (regra {autoWinner.minDays}d / {autoWinner.minViews} views).</span>
                      )
                    ) : (
                      <span>Auto winner desativado.</span>
                    )}
                  </div>

                  {winnerCandidate ? (
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                      Vencedora atual: <span className="font-semibold">{winnerCandidate.name}</span> com{' '}
                      {winnerCandidate.conversion.toFixed(1)}% de conversao ({winnerCandidate.leadsCount} leads em{' '}
                      {winnerCandidate.views} views).
                    </div>
                  ) : potentialWinner ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Lider parcial: <span className="font-semibold">{potentialWinner.name}</span> com{' '}
                      {potentialWinner.conversion.toFixed(1)}% de conversao, mas ainda sem amostra minima de{' '}
                      {minWinnerViews} views.
                    </div>
                  ) : null}

                  {variantStats.map((variant) => {
                    const conversion = variant.conversion.toFixed(1)
                    const trafficShare = variant.trafficShare.toFixed(1)

                    return (
                      <div key={variant.id} className="rounded-md border border-gray-200 p-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{variant.name}</p>
                            <Badge variant="outline" className="text-[10px]">
                              Peso {variant.weight ?? 0}%
                            </Badge>
                            {variant.is_active ? (
                              <Badge variant="secondary" className="text-[10px]">Ativa</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">Inativa</Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">Trafego {trafficShare}%</span>
                        </div>
                        <div className="mt-1 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                          <span>{variant.views} views</span>
                          <span>{variant.leadsCount} leads</span>
                          <span>Conv. {conversion}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leads" className="mt-4">
          {formLeads.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground text-sm">
                Nenhum lead capturado por este formulário ainda.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {formLeads.map(lead => {
                const data = lead.data as Record<string, unknown>
                const name = String(data.name || data.nome || 'Lead sem nome')
                const email = String(data.email || '-')
                const utmSource = extractUtmSource(lead.data)
                return (
                  <Card key={lead.id}>
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{name}</p>
                          <p className="text-xs text-muted-foreground">{email}</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {utmSource && (
                            <Badge variant="outline" className="text-xs">{utmSource}</Badge>
                          )}
                          <Badge variant="secondary">{lead.status}</Badge>
                          <span>Score: {lead.score}</span>
                          <span>{lead.created_at ? new Date(lead.created_at).toLocaleString('pt-BR') : '-'}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="embed" className="mt-4 space-y-4">
          <UTMGenerator appUrl={appUrl} formId={formId} formName={form.name} />

          <Card>
            <CardHeader><CardTitle className="text-base">Iframe (simples)</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">Copie e cole em qualquer página HTML:</p>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto">
{`<iframe
  src="${appUrl}/embed/${formId}"
  width="100%"
  height="600"
  frameborder="0"
></iframe>`}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Inline (com JS)</CardTitle></CardHeader>
            <CardContent>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto">
{`<!-- Compat: embeds with id="leadform-${formId}" still work -->
<div id="trackingform-${formId}"></div>
<script
  src="${appUrl}/embed.js"
  data-form-id="${formId}"
  data-mode="inline"
></script>`}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Popup (botão flutuante)</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">Abre em modal centralizado ao clicar no botão:</p>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto">
{`<script
  src="${appUrl}/embed.js"
  data-form-id="${formId}"
  data-mode="popup"
  data-trigger-label="Fale conosco"
  data-trigger-bottom="20"
></script>`}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Slide-in (lateral)</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">Desliza pela direita ou esquerda:</p>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto">
{`<script
  src="${appUrl}/embed.js"
  data-form-id="${formId}"
  data-mode="slide-right"
  data-trigger-label="Contato"
  data-trigger-bottom="78"
></script>`}
              </pre>
              <p className="text-xs text-muted-foreground mt-2">
                Use <code>slide-left</code> para abrir pela esquerda.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Exit Intent (saída)</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">Abre automaticamente quando o usuário move o mouse para sair da página:</p>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto">
{`<script
  src="${appUrl}/embed.js"
  data-form-id="${formId}"
  data-mode="exit-intent"
></script>`}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
