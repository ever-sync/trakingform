import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

export default function WorkspacePage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Workspace</h1>
        <p className="text-muted-foreground">Configurações do seu workspace</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações gerais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do workspace</Label>
            <Input placeholder="Minha Empresa" />
          </div>
          <div className="space-y-2">
            <Label>Slug</Label>
            <Input placeholder="minha-empresa" />
            <p className="text-xs text-muted-foreground">Usado na URL dos seus formulários</p>
          </div>
          <div className="flex justify-end">
            <Button className="bg-indigo-600 hover:bg-indigo-700">Salvar alterações</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Membros</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href="/workspace/members">Gerenciar membros</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Convide membros para colaborar no workspace.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

