'use client'

import { FormField } from '@/types'
import { Type, Mail, Phone, AlignLeft, List, Circle, CheckSquare, Calendar, EyeOff } from 'lucide-react'

const FIELD_TYPES: { type: FormField['type']; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: 'text', label: 'Texto', icon: Type },
  { type: 'email', label: 'E-mail', icon: Mail },
  { type: 'phone', label: 'Telefone', icon: Phone },
  { type: 'textarea', label: 'Texto longo', icon: AlignLeft },
  { type: 'select', label: 'Lista suspensa', icon: List },
  { type: 'radio', label: 'Múltipla escolha', icon: Circle },
  { type: 'checkbox', label: 'Checkbox', icon: CheckSquare },
  { type: 'date', label: 'Data', icon: Calendar },
  { type: 'hidden', label: 'Campo oculto', icon: EyeOff },
]

interface FieldPaletteProps {
  onAddField: (type: FormField['type']) => void
}

export function FieldPalette({ onAddField }: FieldPaletteProps) {
  return (
    <div className="w-52 flex-shrink-0 overflow-y-auto bg-gray-50 p-3">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2.5 px-1">
        Tipos de campo
      </p>
      <div className="space-y-0.5">
        {FIELD_TYPES.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            onClick={() => onAddField(type)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-white hover:text-black hover:shadow-sm transition-all text-left group"
          >
            <Icon className="h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-gray-600 transition-colors" />
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 px-1">
        <p className="text-[10px] text-gray-400 leading-relaxed">
          Clique em um campo para adicioná-lo ao formulário.
          <br />
          Arraste os campos no canvas para reordenar.
        </p>
      </div>
    </div>
  )
}
