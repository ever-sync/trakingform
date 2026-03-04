import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { forms } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import { FormBuilder } from '@/components/forms/FormBuilder'
import { FormField } from '@/types'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default async function FormEditPage({
  params,
}: {
  params: Promise<{ formId: string }>
}) {
  const { formId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const result = await db.select().from(forms).where(eq(forms.id, formId)).limit(1)
  const form = result[0]
  if (!form) notFound()

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/forms/${formId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{form.name}</h1>
          <p className="text-sm text-muted-foreground">Editor de formulário</p>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <FormBuilder
          formId={form.id}
          initialName={form.name}
          initialFields={(form.fields as FormField[]) ?? []}
          initialSettings={form.settings}
          initialSubmitRedirectUrl={form.submit_redirect_url}
          initialSubmitMessage={form.submit_message}
          initialTheme={form.theme}
          initialEmailTemplateId={form.email_template_id}
        />
      </div>
    </div>
  )
}
