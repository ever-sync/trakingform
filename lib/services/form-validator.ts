import { FormField } from '@/types'

function isValidPhone(value: unknown): boolean {
  const raw = String(value ?? '').trim()
  if (!raw) return false

  const normalized = raw.replace(/[^\d+]/g, '')
  const digitsOnly = normalized.replace(/\D/g, '')

  // E.164 max length is 15 digits; local formats usually at least 10 digits.
  if (digitsOnly.length < 10 || digitsOnly.length > 15) return false

  // Reject obvious fake values like 00000000000.
  if (/^(\d)\1+$/.test(digitsOnly)) return false

  // If number has +, it must be in the beginning.
  if (normalized.includes('+') && !normalized.startsWith('+')) return false

  return true
}

export function validateFormSubmission(
  fields: FormField[],
  data: Record<string, unknown>
): Record<string, string> {
  const errors: Record<string, string> = {}

  for (const field of fields) {
    if (field.type === 'hidden') continue

    const value = data[field.name]

    if (field.required && (value === undefined || value === null || value === '')) {
      errors[field.name] = `${field.label} é obrigatório`
      continue
    }

    if (!value) continue

    if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
      errors[field.name] = `${field.label} deve ser um e-mail válido`
    }

    if (field.type === 'phone' && !isValidPhone(value)) {
      errors[field.name] = `${field.label} deve ser um telefone válido`
    }

    if (field.validation?.minLength && String(value).length < field.validation.minLength) {
      errors[field.name] = `${field.label} deve ter no mínimo ${field.validation.minLength} caracteres`
    }

    if (field.validation?.maxLength && String(value).length > field.validation.maxLength) {
      errors[field.name] = `${field.label} deve ter no máximo ${field.validation.maxLength} caracteres`
    }

    if (field.validation?.pattern && !new RegExp(field.validation.pattern).test(String(value))) {
      errors[field.name] = `${field.label} está em formato inválido`
    }
  }

  return errors
}
