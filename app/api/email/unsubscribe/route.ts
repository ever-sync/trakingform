import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { emailSuppressions } from '@/lib/db/schema'
import { verifyUnsubscribeSignature } from '@/lib/email/unsubscribe-url'

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get('workspace')
  const email = req.nextUrl.searchParams.get('email')
  const sig = req.nextUrl.searchParams.get('sig')

  if (!workspaceId || !email) {
    return NextResponse.json(
      { error: 'Parâmetros obrigatórios ausentes (workspace e e-mail).' },
      { status: 400 },
    )
  }

  const normalized = normalizeEmail(email)

  if (!verifyUnsubscribeSignature(workspaceId, normalized, sig)) {
    return NextResponse.json(
      { error: 'Link inválido ou incompleto. Use o botão Descadastrar do e-mail mais recente.' },
      { status: 403 },
    )
  }

  const [existing] = await db
    .select({ id: emailSuppressions.id })
    .from(emailSuppressions)
    .where(and(eq(emailSuppressions.workspace_id, workspaceId), eq(emailSuppressions.email, normalized)))
    .limit(1)

  if (existing) {
    await db
      .update(emailSuppressions)
      .set({
        is_active: true,
        reason: 'unsubscribe',
        source: 'unsubscribe_link',
        updated_at: new Date(),
      })
      .where(eq(emailSuppressions.id, existing.id))
  } else {
    await db.insert(emailSuppressions).values({
      workspace_id: workspaceId,
      email: normalized,
      is_active: true,
      reason: 'unsubscribe',
      source: 'unsubscribe_link',
    })
  }

  return new NextResponse(
    '<html><body style="font-family:Arial,sans-serif;padding:24px;"><h1>Inscrição cancelada</h1><p>Você não receberá mais e-mails de marketing deste workspace.</p></body></html>',
    {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }
  )
}
