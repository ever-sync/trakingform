import { EmailSettingsClient } from '@/components/workspace/EmailSettingsClient'
import { EmailSuppressionsClient } from '@/components/workspace/EmailSuppressionsClient'

export default function WorkspaceEmailPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Email Settings</h1>
        <p className="text-muted-foreground">Controle provider, remetente padrao e feature flags por workspace.</p>
      </div>

      <EmailSettingsClient />
      <EmailSuppressionsClient />
    </div>
  )
}
