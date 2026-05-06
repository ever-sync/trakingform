import { FormField } from '@/types'

export interface BuilderValidationResult {
  fieldErrors: Record<string, string[]>
  hasErrors: boolean
  totalErrors: number
}

const NAME_REGEX = /^[a-z][a-z0-9_]*$/

export function validateBuilderFields(fields: FormField[]): BuilderValidationResult {
  const fieldErrors: Record<string, string[]> = {}
  const nameMap = new Map<string, string[]>()

  for (const field of fields) {
    const errors: string[] = []
    const label = field.label.trim()
    const name = field.name.trim()

    if (!label) {
      errors.push('Rotulo obrigatorio.')
    }

    if (!name) {
      errors.push('Identificador obrigatorio.')
    } else if (!NAME_REGEX.test(name)) {
      errors.push('Identificador deve comecar com letra e usar apenas a-z, 0-9 e _.')
    }

    const needsOptions = field.type === 'select' || field.type === 'radio' || field.type === 'checkbox'
    if (needsOptions) {
      const options = field.options ?? []
      const validOptions = options.filter((opt) => opt.label.trim().length > 0)
      if (validOptions.length < 1) {
        errors.push('Adicione pelo menos 1 opção válida.')
      }
    }

    if (field.validation?.minLength !== undefined && field.validation.minLength < 0) {
      errors.push('Mínimo de caracteres não pode ser negativo.')
    }

    if (
      field.validation?.minLength !== undefined &&
      field.validation?.maxLength !== undefined &&
      field.validation.minLength > field.validation.maxLength
    ) {
      errors.push('Mínimo de caracteres não pode ser maior que máximo.')
    }

    if (field.validation?.pattern) {
      try {
        new RegExp(field.validation.pattern)
      } catch {
        errors.push('Regex de validação inválida.')
      }
    }

    if (errors.length > 0) {
      fieldErrors[field.id] = errors
    }

    if (name) {
      const ids = nameMap.get(name) ?? []
      ids.push(field.id)
      nameMap.set(name, ids)
    }
  }

  for (const ids of nameMap.values()) {
    if (ids.length > 1) {
      for (const id of ids) {
        fieldErrors[id] = [...(fieldErrors[id] ?? []), 'Identificador duplicado.']
      }
    }
  }

  const totalErrors = Object.values(fieldErrors).reduce((acc, errors) => acc + errors.length, 0)
  return {
    fieldErrors,
    totalErrors,
    hasErrors: totalErrors > 0,
  }
}
