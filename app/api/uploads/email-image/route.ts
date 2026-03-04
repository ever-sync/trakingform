import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateWorkspace } from '@/lib/db/queries/workspace'

const MAX_SIZE = 2 * 1024 * 1024 // 2MB

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getOrCreateWorkspace(user.id, user.email ?? '')

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Apenas arquivos de imagem sao permitidos.' }, { status: 400 })
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Arquivo excede o limite de 2MB.' }, { status: 400 })
  }

  const ext = file.name.split('.').pop() || 'png'
  const path = `${workspace.id}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage
    .from('email-images')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: urlData } = supabase.storage.from('email-images').getPublicUrl(path)
  return NextResponse.json({ url: urlData.publicUrl })
}
