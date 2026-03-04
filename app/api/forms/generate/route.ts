import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateFormFields } from '@/lib/services/ai-form-generator'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { description: string }

  if (!body.description?.trim()) {
    return NextResponse.json({ error: 'Description required' }, { status: 400 })
  }

  try {
    const fields = await generateFormFields(body.description.trim())
    return NextResponse.json({ fields })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
