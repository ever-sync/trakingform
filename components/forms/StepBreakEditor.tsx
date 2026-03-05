'use client'

import type { DragEvent } from 'react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2 } from 'lucide-react'

export interface StepConfig {
  title: string
  fieldIds: string[]
}

interface StepField {
  id: string
  label: string
  type: string
}

interface StepBreakEditorProps {
  steps: StepConfig[]
  fields: StepField[]
  onChange: (steps: StepConfig[]) => void
  onAutoSplit: () => void
}

export function StepBreakEditor({ steps, fields, onChange, onAutoSplit }: StepBreakEditorProps) {
  const [dragFieldId, setDragFieldId] = useState<string | null>(null)

  const fieldById = useMemo(() => {
    return fields.reduce<Record<string, StepField>>((acc, field) => {
      acc[field.id] = field
      return acc
    }, {})
  }, [fields])

  const assignedFieldIds = useMemo(
    () => new Set(steps.flatMap((step) => step.fieldIds)),
    [steps]
  )
  const unassignedFields = fields.filter((field) => !assignedFieldIds.has(field.id))

  if (steps.length === 0) return null

  function moveFieldToStep(fieldId: string, targetStepIndex: number) {
    const sourceStepIndex = steps.findIndex((step) => step.fieldIds.includes(fieldId))
    if (sourceStepIndex === targetStepIndex) return

    const next = steps.map((step) => ({ ...step, fieldIds: [...step.fieldIds] }))

    if (sourceStepIndex >= 0) {
      next[sourceStepIndex].fieldIds = next[sourceStepIndex].fieldIds.filter((id) => id !== fieldId)
    }

    if (!next[targetStepIndex].fieldIds.includes(fieldId)) {
      next[targetStepIndex].fieldIds.push(fieldId)
    }

    onChange(next)
  }

  function handleDrop(targetStepIndex: number, event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const droppedId = event.dataTransfer.getData('text/plain') || dragFieldId
    setDragFieldId(null)
    if (!droppedId) return
    moveFieldToStep(droppedId, targetStepIndex)
  }

  return (
    <div className="mt-2 space-y-2">
      {steps.map((step, idx) => (
        <div key={idx} className="rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2">
          <div className="mb-1.5 flex items-center gap-2">
            <Badge variant="secondary" className="h-5 shrink-0 text-[10px]">
              Etapa {idx + 1}
            </Badge>
            <Input
              value={step.title}
              onChange={(event) => {
                const next = [...steps]
                next[idx] = { ...next[idx], title: event.target.value }
                onChange(next)
              }}
              className="h-7 flex-1 text-xs"
              placeholder="Titulo da etapa"
            />
            <span className="shrink-0 text-[10px] text-gray-400">{step.fieldIds.length} campos</span>
            {steps.length > 1 ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                onClick={() => {
                  const next = [...steps]
                  if (idx > 0) {
                    next[idx - 1] = {
                      ...next[idx - 1],
                      fieldIds: [...next[idx - 1].fieldIds, ...step.fieldIds],
                    }
                  } else if (next.length > 1) {
                    next[1] = {
                      ...next[1],
                      fieldIds: [...step.fieldIds, ...next[1].fieldIds],
                    }
                  }
                  next.splice(idx, 1)
                  onChange(next)
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            ) : null}
          </div>

          <div
            className="min-h-10 rounded border border-dashed border-gray-200 bg-white p-1.5"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleDrop(idx, event)}
          >
            {step.fieldIds.length === 0 ? (
              <p className="text-[11px] text-gray-400">Arraste campos para esta etapa</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {step.fieldIds.map((fieldId) => {
                  const field = fieldById[fieldId]
                  if (!field) return null

                  return (
                    <button
                      key={field.id}
                      type="button"
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/plain', field.id)
                        setDragFieldId(field.id)
                      }}
                      className="rounded bg-gray-100 px-2 py-1 text-[11px] text-gray-900"
                      title={`${field.label} (${field.type})`}
                    >
                      {field.label || field.id}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      ))}

      {unassignedFields.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
          <p className="mb-1 text-[11px] font-medium text-amber-700">Campos sem etapa</p>
          <div className="flex flex-wrap gap-1.5">
            {unassignedFields.map((field) => (
              <button
                key={field.id}
                type="button"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/plain', field.id)
                  setDragFieldId(field.id)
                }}
                className="rounded bg-white px-2 py-1 text-[11px] text-amber-700"
                title={`${field.label} (${field.type})`}
              >
                {field.label || field.id}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-7 w-full text-xs"
          onClick={() => onChange([...steps, { title: `Etapa ${steps.length + 1}`, fieldIds: [] }])}
        >
          <Plus className="mr-1 h-3 w-3" />
          Adicionar etapa
        </Button>
        <Button size="sm" variant="outline" className="h-7 px-3 text-xs" onClick={onAutoSplit}>
          Auto-dividir
        </Button>
      </div>
    </div>
  )
}
