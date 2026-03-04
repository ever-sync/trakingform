'use client'

import { FormField } from '@/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { AlertTriangle, Plus, X, Settings2 } from 'lucide-react'

interface FieldEditorProps {
  field: FormField | null
  errors?: string[]
  onUpdate: (updates: Partial<FormField>) => void
}

export function FieldEditor({ field, errors = [], onUpdate }: FieldEditorProps) {
  if (!field) {
    return (
      <div className="w-64 flex-shrink-0 bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <Settings2 className="h-8 w-8 text-gray-200 mb-3" />
        <p className="text-sm font-medium text-gray-400">Nenhum campo selecionado</p>
        <p className="text-xs text-gray-300 mt-1">
          Clique em um campo no canvas para editar
        </p>
      </div>
    )
  }

  const hasOptions = ['select', 'radio', 'checkbox'].includes(field.type)
  const hasPlaceholder = !['hidden', 'checkbox', 'radio', 'date'].includes(field.type)
  const hasValidation = ['text', 'textarea', 'email', 'phone'].includes(field.type)

  function addOption() {
    if (!field) return
    const options = [
      ...(field.options ?? []),
      { label: `Opção ${(field.options?.length ?? 0) + 1}`, value: `opcao_${Date.now()}` },
    ]
    onUpdate({ options })
  }

  function updateOption(index: number, label: string) {
    if (!field) return
    const options = [...(field.options ?? [])]
    options[index] = { label, value: label.toLowerCase().replace(/\s+/g, '_') }
    onUpdate({ options })
  }

  function removeOption(index: number) {
    if (!field) return
    onUpdate({ options: (field.options ?? []).filter((_, i) => i !== index) })
  }

  return (
    <div className="w-64 flex-shrink-0 overflow-y-auto bg-white border-l">
      <div className="px-4 py-3 border-b bg-gray-50/80">
        <p className="text-xs font-semibold text-gray-700">Propriedades</p>
      </div>

      <div className="p-4 space-y-4">
        {errors.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5" />
              Ajustes necessarios para publicar
            </div>
            <ul className="space-y-1 text-xs text-amber-700">
              {errors.map((error) => (
                <li key={error}>- {error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Label */}
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-600">Rótulo *</Label>
          <Input
            value={field.label}
            onChange={e => onUpdate({ label: e.target.value })}
            placeholder="Nome do campo"
            className="h-8 text-sm"
          />
        </div>

        {/* Field name */}
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-600">Identificador</Label>
          <Input
            value={field.name}
            onChange={e =>
              onUpdate({ name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })
            }
            placeholder="nome_do_campo"
            className="h-8 text-sm font-mono"
          />
          <p className="text-[10px] text-gray-400">Chave nos dados do lead</p>
        </div>

        {/* Placeholder */}
        {hasPlaceholder && (
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">Placeholder</Label>
            <Input
              value={field.placeholder ?? ''}
              onChange={e => onUpdate({ placeholder: e.target.value })}
              placeholder="Texto de exemplo..."
              className="h-8 text-sm"
            />
          </div>
        )}

        {/* Help text */}
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-600">Texto de ajuda</Label>
          <Input
            value={field.helpText ?? ''}
            onChange={e => onUpdate({ helpText: e.target.value })}
            placeholder="Instrução opcional..."
            className="h-8 text-sm"
          />
        </div>

        {/* Required toggle */}
        <div className="flex items-center justify-between py-0.5">
          <Label className="text-xs text-gray-600 cursor-pointer">Obrigatório</Label>
          <Switch
            checked={field.required}
            onCheckedChange={checked => onUpdate({ required: checked })}
          />
        </div>

        {/* Default value for hidden */}
        {field.type === 'hidden' && (
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">Valor padrão</Label>
            <Input
              value={field.defaultValue ?? ''}
              onChange={e => onUpdate({ defaultValue: e.target.value })}
              placeholder="valor"
              className="h-8 text-sm font-mono"
            />
          </div>
        )}

        {/* Options */}
        {hasOptions && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-gray-700">Opções</Label>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                  onClick={addOption}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Adicionar
                </Button>
              </div>

              <div className="space-y-1.5">
                {(field.options ?? []).map((opt, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Input
                      value={opt.label}
                      onChange={e => updateOption(i, e.target.value)}
                      placeholder="Rótulo da opção"
                      className="h-7 text-xs flex-1"
                    />
                    <button
                      onClick={() => removeOption(i)}
                      className="flex-shrink-0 p-1 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {(field.options?.length ?? 0) === 0 && (
                  <p className="text-xs text-gray-400 italic">Nenhuma opção ainda</p>
                )}
              </div>
            </div>
          </>
        )}

        {/* Validation */}
        {hasValidation && (
          <>
            <Separator />
            <div className="space-y-2.5">
              <Label className="text-xs font-semibold text-gray-700">Validação</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-gray-400">Mín. chars</Label>
                  <Input
                    type="number"
                    min={0}
                    value={field.validation?.minLength ?? ''}
                    onChange={e =>
                      onUpdate({
                        validation: {
                          ...field.validation,
                          minLength: e.target.value ? Number(e.target.value) : undefined,
                        },
                      })
                    }
                    className="h-7 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-gray-400">Máx. chars</Label>
                  <Input
                    type="number"
                    min={0}
                    value={field.validation?.maxLength ?? ''}
                    onChange={e =>
                      onUpdate({
                        validation: {
                          ...field.validation,
                          maxLength: e.target.value ? Number(e.target.value) : undefined,
                        },
                      })
                    }
                    className="h-7 text-xs"
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
