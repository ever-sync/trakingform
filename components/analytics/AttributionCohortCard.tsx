'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface CohortItem {
  label: string
  leads: number
  conversion: number
}

export function AttributionCohortCard({ items }: { items: CohortItem[] }) {
  const max = Math.max(...items.map((item) => item.leads), 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Coortes por origem/campanha</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados de coortes.</p>
        ) : (
          items.map((item) => {
            const width = max > 0 ? (item.leads / max) * 100 : 0
            return (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium">{item.label}</span>
                  <span className="text-muted-foreground">{item.leads} leads | {item.conversion.toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div className="h-2 rounded-full bg-gray-1000" style={{ width: `${width}%` }} />
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
