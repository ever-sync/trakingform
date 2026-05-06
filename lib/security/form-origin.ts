import type { NextRequest } from 'next/server'

function hostnameFromAbsoluteUrl(urlLike: string): string | null {
  try {
    return new URL(urlLike).hostname.toLowerCase()
  } catch {
    return null
  }
}

/** Hostnames em Origin e Referer (embed iframe costuma mandar só o Origin do próprio SaaS). */
export function embedRequestHostHints(req: NextRequest): string[] {
  const hints = new Set<string>()

  const origin = req.headers.get('origin')
  if (origin && origin !== 'null') {
    const h = hostnameFromAbsoluteUrl(origin)
    if (h) hints.add(h)
  }

  const referer = req.headers.get('referer')
  if (referer) {
    const h = hostnameFromAbsoluteUrl(referer)
    if (h) hints.add(h)
  }

  return [...hints]
}

/** Host público onde a app está servida — sempre aceito quando há domínios cadastrados (embed em iframe usa este Origin). */
function implicitTrustedHosts(): string[] {
  const set = new Set<string>()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl) {
    const h = hostnameFromAbsoluteUrl(appUrl)
    if (h) set.add(h)
  }

  const vercelHost = process.env.VERCEL_URL
  if (vercelHost) {
    const h = hostnameFromAbsoluteUrl(`https://${vercelHost}`)
    if (h) set.add(h)
  }

  return [...set]
}

function matchesAllowedEntry(hostname: string, entry: string) {
  return hostname === entry || hostname.endsWith(`.${entry}`)
}

/**
 * `allowed_domains` vazio = aceita qualquer pedido que passe no restante da rota.
 *
 * Lista preenchida: pelo menos um hostname de Origin ou Referer deve casar com
 * a lista configurada ou com o host do próprio app (`NEXT_PUBLIC_APP_URL` / `VERCEL_URL`).
 * Sem hints (ex.: cliente sem Origin/Referer) = bloqueado.
 */
export function isFormOriginAllowed(
  req: NextRequest,
  allowedDomains: string[] | null | undefined,
): boolean {
  if (!allowedDomains?.length) return true

  const configured = [...new Set(allowedDomains.map((d) => d.trim().toLowerCase()).filter(Boolean))]
  const allowEntries = [...new Set([...configured, ...implicitTrustedHosts()])]
  if (allowEntries.length === 0) return true

  const hints = embedRequestHostHints(req)
  if (hints.length === 0) return false

  return hints.some((host) => allowEntries.some((entry) => matchesAllowedEntry(host, entry)))
}
