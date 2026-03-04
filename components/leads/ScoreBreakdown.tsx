'use client'

import { Badge } from '@/components/ui/badge'

interface ScoringFactor {
  name: string
  impact: number
  description: string
}

function getScoreColor(score: number) {
  if (score >= 70) return 'bg-green-100 text-green-700'
  if (score >= 40) return 'bg-yellow-100 text-yellow-700'
  return 'bg-gray-100 text-gray-700'
}

function getScoreLabel(score: number) {
  if (score >= 70) return 'Quente'
  if (score >= 40) return 'Morno'
  return 'Frio'
}

export function ScoreBreakdown({ score, factors }: { score: number; factors?: ScoringFactor[] }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold ${getScoreColor(score)}`}>
          {score} - {getScoreLabel(score)}
        </div>
      </div>

      {factors && factors.length > 0 && (
        <div className="space-y-1">
          {factors.map((factor, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs">
              <span className="text-gray-600">{factor.name}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-gray-400">{factor.description}</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${factor.impact >= 0 ? 'text-green-600 border-green-200' : 'text-red-600 border-red-200'}`}
                >
                  {factor.impact > 0 ? '+' : ''}{factor.impact}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
