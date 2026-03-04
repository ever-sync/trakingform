import { EmailProviderAdapter } from '@/lib/services/email/provider'
import { ResendAdapter } from '@/lib/services/email/providers/resend'

const resendAdapter = new ResendAdapter()

export class EmailProviderRegistry {
  resolve(name?: string | null): EmailProviderAdapter {
    const provider = String(name ?? 'resend').toLowerCase().trim()
    if (provider === 'resend') return resendAdapter
    return resendAdapter
  }

  getPrimary(): EmailProviderAdapter {
    return resendAdapter
  }
}

export const emailProviderRegistry = new EmailProviderRegistry()
