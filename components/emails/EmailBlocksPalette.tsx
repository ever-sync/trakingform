'use client'

import { Button } from '@/components/ui/button'
import { EmailBlock } from '@/types'

const BLOCKS: Array<{ type: EmailBlock['type']; label: string }> = [
  { type: 'header', label: 'Header' },
  { type: 'text', label: 'Texto' },
  { type: 'image', label: 'Imagem' },
  { type: 'button', label: 'Botao' },
  { type: 'divider', label: 'Divisor' },
  { type: 'footer', label: 'Rodape' },
]

export function EmailBlocksPalette({ onAdd }: { onAdd: (type: EmailBlock['type']) => void }) {
  return (
    <div className="w-56 border-r bg-white p-3">
      <p className="text-xs font-semibold text-gray-600">Blocos</p>
      <div className="mt-3 space-y-2">
        {BLOCKS.map((block) => (
          <Button
            key={block.type}
            variant="outline"
            className="w-full justify-start"
            onClick={() => onAdd(block.type)}
          >
            {block.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
