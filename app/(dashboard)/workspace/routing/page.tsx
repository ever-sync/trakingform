import { RulesBuilder } from '@/components/routing/RulesBuilder'
import { SlaPoliciesClient } from '@/components/routing/SlaPoliciesClient'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function RoutingPage() {
  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Routing de Leads</h1>
        <p className="text-muted-foreground">
          Defina regras para distribuir leads por origem, score e contexto, além de políticas de SLA.
        </p>
      </div>

      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rules">Regras</TabsTrigger>
          <TabsTrigger value="sla">Políticas SLA</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-4">
          <RulesBuilder />
        </TabsContent>

        <TabsContent value="sla" className="space-y-4">
          <SlaPoliciesClient />
        </TabsContent>
      </Tabs>
    </div>
  )
}
