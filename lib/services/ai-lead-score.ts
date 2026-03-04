import { ScoringFactor } from '@/types'

interface EnhancedScoringInput {
  data: Record<string, unknown>
  emailDomain: string
  phoneValid: boolean
  timeToCompleteSeconds: number
  deviceType: string
  isVPN: boolean
  isProxy: boolean
  allRequiredFieldsFilled: boolean
  isDuplicate: boolean
  countryCode?: string
  targetCountries?: string[]
  hasUtmSource: boolean
  fieldsFilledCount: number
  totalFieldsCount: number
}

interface ScoringResult {
  score: number
  factors: ScoringFactor[]
}

const FREE_PROVIDERS = ['gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com', 'bol.com.br', 'uol.com.br', 'live.com', 'icloud.com']

export function calculateEnhancedLeadScore(input: EnhancedScoringInput): ScoringResult {
  const factors: ScoringFactor[] = []
  let score = 0

  // Email quality
  const isCorporateEmail = input.emailDomain && !FREE_PROVIDERS.some(p => input.emailDomain.endsWith(p))
  if (isCorporateEmail) {
    score += 20
    factors.push({ name: 'E-mail corporativo', impact: 20, description: `Dominio ${input.emailDomain} indica empresa` })
  } else {
    score += 8
    factors.push({ name: 'E-mail pessoal', impact: 8, description: 'E-mail gratuito detectado' })
  }

  // Phone validation
  if (input.phoneValid) {
    score += 15
    factors.push({ name: 'Telefone valido', impact: 15, description: 'Numero de telefone fornecido' })
  }

  // Time to complete (engagement signal)
  const t = input.timeToCompleteSeconds
  if (t >= 60 && t <= 240) {
    score += 12
    factors.push({ name: 'Tempo ideal', impact: 12, description: `Preencheu em ${t}s - engajamento alto` })
  } else if (t >= 30 && t < 60) {
    score += 6
    factors.push({ name: 'Preenchimento rapido', impact: 6, description: `Preencheu em ${t}s` })
  } else if (t > 240 && t <= 600) {
    score += 4
    factors.push({ name: 'Preenchimento lento', impact: 4, description: `Preencheu em ${t}s - pode indicar hesitacao` })
  } else if (t > 0) {
    score += 2
    factors.push({ name: 'Tempo atipico', impact: 2, description: `Tempo de ${t}s fora do padrao` })
  }

  // Device type
  if (input.deviceType === 'desktop') {
    score += 8
    factors.push({ name: 'Desktop', impact: 8, description: 'Acesso via computador' })
  } else {
    score += 4
    factors.push({ name: 'Dispositivo movel', impact: 4, description: `Acesso via ${input.deviceType}` })
  }

  // Privacy/Security flags
  if (input.isVPN || input.isProxy) {
    score -= 15
    factors.push({ name: 'VPN/Proxy detectado', impact: -15, description: 'Uso de VPN ou proxy pode indicar anonimato' })
  }

  // Form completion quality
  if (input.allRequiredFieldsFilled) {
    score += 10
    factors.push({ name: 'Campos obrigatorios', impact: 10, description: 'Todos os campos obrigatorios preenchidos' })
  }

  // Fields filled ratio (bonus for optional fields)
  const fillRatio = input.totalFieldsCount > 0 ? input.fieldsFilledCount / input.totalFieldsCount : 0
  if (fillRatio >= 0.9) {
    score += 10
    factors.push({ name: 'Formulario completo', impact: 10, description: `${Math.round(fillRatio * 100)}% dos campos preenchidos` })
  } else if (fillRatio >= 0.7) {
    score += 5
    factors.push({ name: 'Formulario parcial', impact: 5, description: `${Math.round(fillRatio * 100)}% dos campos preenchidos` })
  }

  // UTM source
  if (input.hasUtmSource) {
    score += 5
    factors.push({ name: 'Campanha rastreada', impact: 5, description: 'Lead veio de campanha com UTM' })
  }

  // Country targeting
  if (input.targetCountries && input.countryCode) {
    if (input.targetCountries.includes(input.countryCode)) {
      score += 15
      factors.push({ name: 'Pais-alvo', impact: 15, description: `Pais ${input.countryCode} esta na lista de alvos` })
    } else {
      score -= 10
      factors.push({ name: 'Fora do pais-alvo', impact: -10, description: `Pais ${input.countryCode} nao e alvo` })
    }
  }

  // Duplicate penalty
  if (input.isDuplicate) {
    score -= 30
    factors.push({ name: 'Lead duplicado', impact: -30, description: 'Este lead ja foi capturado anteriormente' })
  }

  // Data quality: check for real-looking name
  const name = String(input.data.name || input.data.nome || '')
  if (name.length > 3 && name.includes(' ')) {
    score += 5
    factors.push({ name: 'Nome completo', impact: 5, description: 'Nome com sobrenome fornecido' })
  }

  const finalScore = Math.max(0, Math.min(100, score))

  return {
    score: finalScore,
    factors: factors.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)),
  }
}
