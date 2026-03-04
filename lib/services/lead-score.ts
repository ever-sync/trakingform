interface ScoringInput {
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
}

export function calculateLeadScore(input: ScoringInput): number {
  let score = 0

  const freeProviders = ['gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com', 'bol.com.br', 'uol.com.br']
  const isCorporateEmail = !freeProviders.some(p => input.emailDomain.endsWith(p))
  score += isCorporateEmail ? 20 : 8

  if (input.phoneValid) score += 15

  const t = input.timeToCompleteSeconds
  if (t >= 60 && t <= 240) score += 10
  else if (t >= 30 && t < 60) score += 5
  else if (t > 240 && t <= 600) score += 3

  if (input.deviceType === 'desktop') score += 8
  else if (input.deviceType === 'tablet') score += 5
  else score += 3

  if (input.isVPN || input.isProxy) score -= 15

  if (input.allRequiredFieldsFilled) score += 15

  if (input.targetCountries && input.countryCode) {
    if (input.targetCountries.includes(input.countryCode)) score += 15
    else score -= 10
  }

  if (input.isDuplicate) score -= 30

  return Math.max(0, Math.min(100, score))
}
