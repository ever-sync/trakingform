import { RecoveryCampaignsClient } from '@/components/workspace/RecoveryCampaignsClient'

export default function WorkspaceRecoveryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Recovery de Abandono</h1>
        <p className="text-muted-foreground">Automatize retomada de formulários não concluídos.</p>
      </div>

      <RecoveryCampaignsClient />
    </div>
  )
}
