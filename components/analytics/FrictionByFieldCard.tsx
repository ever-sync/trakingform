'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface FrictionItem {
  field: string
  abandons: number
  avgTimeSec: number
  errorRate: number
}

export function FrictionByFieldCard({ items }: { items: FrictionItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Friccao por campo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados suficientes para friccao por campo.</p>
        ) : (
          items.map((item) => (
            <div key={item.field} className="rounded border p-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{item.field}</span>
                <span className="text-muted-foreground">abandono {item.abandons}</span>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-2 text-muted-foreground">
                <span>Tempo medio: {item.avgTimeSec.toFixed(1)}s</span>
                <span>Erro: {(item.errorRate * 100).toFixed(1)}%</span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
