import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Mail } from 'lucide-react'

export default function EmailsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">E-mails</h1>
          <p className="text-muted-foreground">Templates e campanhas de e-mail</p>
        </div>
        <Button asChild className="bg-indigo-600 hover:bg-indigo-700">
          <Link href="/emails/new">
            <Plus className="h-4 w-4 mr-2" />
            Novo template
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mb-4">
            <Mail className="h-6 w-6 text-indigo-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Nenhum template criado</h3>
          <p className="text-sm text-muted-foreground text-center mb-4 max-w-sm">
            Crie templates de e-mail para nutrir seus leads automaticamente.
          </p>
          <Button asChild className="bg-indigo-600 hover:bg-indigo-700">
            <Link href="/emails/new">
              <Plus className="h-4 w-4 mr-2" />
              Criar template
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
