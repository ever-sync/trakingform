import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Webhook } from 'lucide-react'

export default function WebhooksPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Webhooks</h1>
          <p className="text-muted-foreground">Roteie leads para sistemas externos</p>
        </div>
        <Button asChild className="bg-indigo-600 hover:bg-indigo-700">
          <Link href="/webhooks/new">
            <Plus className="h-4 w-4 mr-2" />
            Novo destino
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mb-4">
            <Webhook className="h-6 w-6 text-indigo-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Nenhum webhook configurado</h3>
          <p className="text-sm text-muted-foreground text-center mb-4 max-w-sm">
            Configure destinos para enviar leads automaticamente para n8n, WhatsApp, CRMs e mais.
          </p>
          <Button asChild className="bg-indigo-600 hover:bg-indigo-700">
            <Link href="/webhooks/new">
              <Plus className="h-4 w-4 mr-2" />
              Criar destino
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
