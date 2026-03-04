'use client'

import { useDraggable } from '@dnd-kit/core'
import { Button } from '@/components/ui/button'
import { EmailBlock } from '@/types'
import { LayoutTemplate, Type, ImageIcon, MousePointerClick, Minus, PanelBottom } from 'lucide-react'

const BLOCKS: Array<{ type: EmailBlock['type']; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { type: 'header', label: 'Header', icon: LayoutTemplate },
  { type: 'text', label: 'Texto', icon: Type },
  { type: 'image', label: 'Imagem', icon: ImageIcon },
  { type: 'button', label: 'Botao', icon: MousePointerClick },
  { type: 'divider', label: 'Divisor', icon: Minus },
  { type: 'footer', label: 'Rodape', icon: PanelBottom },
]

function DraggablePaletteItem({
  type,
  label,
  icon: Icon,
  onAdd,
}: {
  type: EmailBlock['type']
  label: string
  icon: React.ComponentType<{ className?: string }>
  onAdd: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${type}`,
    data: { fromPalette: true, blockType: type },
  })

  return (
    <Button
      ref={setNodeRef}
      variant="outline"
      className={`w-full justify-start ${isDragging ? 'opacity-50' : ''}`}
      onClick={onAdd}
      {...attributes}
      {...listeners}
    >
      <Icon className="mr-2 h-4 w-4" />
      {label}
    </Button>
  )
}

export function EmailBlocksPalette({ onAdd }: { onAdd: (type: EmailBlock['type']) => void }) {
  return (
    <div className="w-56 border-r bg-white p-3">
      <p className="text-xs font-semibold text-gray-600">Blocos</p>
      <p className="mt-0.5 text-[11px] text-gray-400">Clique ou arraste para o canvas</p>
      <div className="mt-3 space-y-2">
        {BLOCKS.map((block) => (
          <DraggablePaletteItem
            key={block.type}
            type={block.type}
            label={block.label}
            icon={block.icon}
            onAdd={() => onAdd(block.type)}
          />
        ))}
      </div>
    </div>
  )
}
