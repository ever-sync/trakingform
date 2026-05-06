import { createHmac, timingSafeEqual } from 'node:crypto'

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export function signUnsubscribePayload(workspaceId: string, email: string, secret: string) {
  const payload = `${workspaceId}\n${normalizeEmail(email)}`
  return createHmac('sha256', secret).update(payload).digest('hex')
}

/**
 * Sem `EMAIL_UNSUBSCRIBE_SECRET`, links continuam apenas com workspace + email (legado).
 * Com secret configurado, a rota `/api/email/unsubscribe` exige `sig` válido.
 */
export function buildUnsubscribeUrl(appUrl: string, workspaceId: string, email: string) {
  const base = appUrl.replace(/\/$/, '')
  const u = new URL(`${base}/api/email/unsubscribe`)
  u.searchParams.set('workspace', workspaceId)
  u.searchParams.set('email', email)

  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET
  if (secret) {
    u.searchParams.set('sig', signUnsubscribePayload(workspaceId, email, secret))
  }

  return u.toString()
}

export function verifyUnsubscribeSignature(
  workspaceId: string,
  email: string,
  sig: string | null,
): boolean {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET
  if (!secret) return true
  if (!sig || sig.length !== 64) return false
  const expected = signUnsubscribePayload(workspaceId, email, secret)
  try {
    return timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}
