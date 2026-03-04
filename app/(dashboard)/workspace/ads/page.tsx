import { AdsIntegrationsClient } from '@/components/workspace/AdsIntegrationsClient'

export default function WorkspaceAdsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Integrações de Ads</h1>
        <p className="text-muted-foreground">Configure Google Ads e Meta para sincronizar conversões de leads.</p>
      </div>

      <AdsIntegrationsClient />
    </div>
  )
}
