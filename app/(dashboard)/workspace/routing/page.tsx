import { RulesBuilder } from '@/components/routing/RulesBuilder'

export default function RoutingPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Routing de Leads</h1>
        <p className="text-muted-foreground">Defina regras para distribuir leads por origem, score e contexto.</p>
      </div>

      <RulesBuilder />
    </div>
  )
}

