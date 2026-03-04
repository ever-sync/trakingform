'use client'

import { Badge } from '@/components/ui/badge'
import { Flame, Snowflake, Thermometer, TrendingUp, TrendingDown } from 'lucide-react'

interface ScoringFactor {
  name: string
  impact: number
  description: string
}

function getScoreConfig(score: number) {
  if (score >= 70)
    return {
      label: 'Quente',
      icon: Flame,
      gradient: 'from-green-500 to-emerald-500',
      bg: 'bg-green-50',
      text: 'text-green-700',
      bar: 'bg-linear-to-r from-green-400 to-emerald-500',
      ring: 'ring-green-100',
    }
  if (score >= 40)
    return {
      label: 'Morno',
      icon: Thermometer,
      gradient: 'from-amber-400 to-yellow-500',
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      bar: 'bg-linear-to-r from-amber-400 to-yellow-500',
      ring: 'ring-amber-100',
    }
  return {
    label: 'Frio',
    icon: Snowflake,
    gradient: 'from-blue-400 to-cyan-500',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    bar: 'bg-linear-to-r from-blue-400 to-cyan-500',
    ring: 'ring-blue-100',
  }
}

export function ScoreBreakdown({ score, factors }: { score: number; factors?: ScoringFactor[] }) {
  const config = getScoreConfig(score)
  const Icon = config.icon
  const pct = Math.min(100, Math.max(0, score))

  return (
    <div className={`rounded-xl border border-gray-100 p-4 ${config.bg} ring-1 ${config.ring}`}>
      {/* Score header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`flex items-center justify-center w-9 h-9 rounded-xl bg-linear-to-br ${config.gradient} shadow-sm`}>
            <Icon className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 leading-none">{score}</div>
            <div className={`text-xs font-semibold ${config.text} mt-0.5`}>{config.label}</div>
          </div>
        </div>
        <div className="text-right text-xs text-gray-400">/ 100</div>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-white/70 overflow-hidden mb-3 shadow-inner">
        <div
          className={`h-full rounded-full ${config.bar} transition-all duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Factors */}
      {factors && factors.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-black/5">
          {factors.map((factor, idx) => {
            const isPositive = factor.impact >= 0
            return (
              <div key={idx} className="flex items-center justify-between py-1 group">
                <div className="flex items-center gap-2 text-xs">
                  {isPositive ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                  <span className="text-gray-600 font-medium">{factor.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400 hidden group-hover:inline transition-all">
                    {factor.description}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-semibold tabular-nums px-1.5 ${
                      isPositive
                        ? 'text-green-600 border-green-200 bg-green-50'
                        : 'text-red-600 border-red-200 bg-red-50'
                    }`}
                  >
                    {factor.impact > 0 ? '+' : ''}
                    {factor.impact}
                  </Badge>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
