'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Loader2, Play, RefreshCw } from 'lucide-react'

export function OperationsActionsClient() {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  async function runAction(key: 'ads' | 'sla' | 'recovery' | 'email') {
    setLoading(key)
    try {
      const endpoint = key === 'ads'
        ? '/api/integrations/ads/sync'
        : key === 'sla'
          ? '/api/routing/sla/run'
          : key === 'recovery'
            ? '/api/recovery/campaigns'
            : '/api/email/dispatch/process'

      const body = key === 'recovery' ? { run_now: true } : {}

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Falha na execucao')
      const data = await res.json()

      if (key === 'ads') toast.success(`Sync Ads: ${data.sent ?? 0} enviado(s).`)
      if (key === 'sla') toast.success(`SLA monitor: ${data.generated ?? 0} alerta(s).`)
      if (key === 'recovery') toast.success(`Recovery: ${data.sent ?? 0} envio(s).`)
      if (key === 'email') toast.success(`Email dispatch: ${data.sent ?? 0} enviado(s).`)
      router.refresh()
    } catch {
      toast.error('Nao foi possivel executar a acao.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => void runAction('ads')} disabled={loading !== null}>
        {loading === 'ads' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
        Sync Ads
      </Button>
      <Button variant="outline" onClick={() => void runAction('sla')} disabled={loading !== null}>
        {loading === 'sla' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Play className="mr-1.5 h-4 w-4" />}
        Rodar SLA
      </Button>
      <Button variant="outline" onClick={() => void runAction('recovery')} disabled={loading !== null}>
        {loading === 'recovery' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Play className="mr-1.5 h-4 w-4" />}
        Rodar Recovery
      </Button>
      <Button variant="outline" onClick={() => void runAction('email')} disabled={loading !== null}>
        {loading === 'email' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Play className="mr-1.5 h-4 w-4" />}
        Rodar Email Dispatch
      </Button>
    </div>
  )
}
