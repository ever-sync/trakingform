import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft } from 'lucide-react'

export default function NewEmailTemplatePage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/emails"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Novo template</h1>
          <p className="text-muted-foreground">Crie um template de e-mail</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Informações básicas</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do template</Label>
            <Input placeholder="Ex: Boas-vindas ao lead" />
          </div>
          <div className="space-y-2">
            <Label>Assunto do e-mail</Label>
            <Input placeholder="Ex: Olá {{nome}}, obrigado pelo contato!" />
          </div>
          <div className="space-y-2">
            <Label>De (nome)</Label>
            <Input placeholder="Ex: João da Empresa" />
          </div>
          <div className="space-y-2">
            <Label>De (e-mail)</Label>
            <Input placeholder="contato@empresa.com" type="email" />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" asChild><Link href="/emails">Cancelar</Link></Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700">Criar e editar template</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
