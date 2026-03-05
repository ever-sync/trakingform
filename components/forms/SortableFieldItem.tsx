'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { FormField } from '@/types'
import { AlertCircle, GripVertical, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const TYPE_LABELS: Record<string, string> = {
  text: 'Texto',
  email: 'E-mail',
  phone: 'Telefone',
  textarea: 'Texto longo',
  select: 'Lista suspensa',
  radio: 'Múltipla escolha',
  checkbox: 'Checkbox',
  date: 'Data',
  hidden: 'Oculto',
}

interface SortableFieldItemProps {
  field: FormField
  isSelected: boolean
  errorCount?: number
  onSelect: () => void
  onRemove: () => void
}

export function SortableFieldItem({ field, isSelected, errorCount = 0, onSelect, onRemove }: SortableFieldItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={cn(
        'flex items-center gap-2.5 p-3 rounded-lg border bg-white cursor-pointer transition-all select-none',
        isSelected
          ? 'border-black ring-1 ring-black shadow-sm'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm',
        isDragging && 'opacity-40 shadow-xl scale-[1.02]'
      )}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors"
        onClick={e => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-gray-800 truncate">{field.label}</span>
          {field.required && <span className="text-red-500 text-xs leading-none">*</span>}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
            {TYPE_LABELS[field.type] ?? field.type}
          </Badge>
          <span className="text-[11px] text-gray-400 font-mono truncate">{field.name}</span>
          {errorCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-amber-700">
              <AlertCircle className="h-3 w-3" />
              {errorCount} erro{errorCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Remove */}
      <button
        onClick={e => {
          e.stopPropagation()
          onRemove()
        }}
        className="flex-shrink-0 p-1 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
