import { Plan, PlanLimits } from '@/types'

export const PLANS: Record<Plan, PlanLimits> = {
  starter: {
    maxForms: 3,
    maxLeadsPerMonth: 500,
    maxWorkspaces: 1,
    maxEmailTemplates: 3,
    maxWebhookDestinations: 1,
    hasIPEnrichment: 'basic',
    hasLeadScoring: false,
    hasWhiteLabel: false,
    hasCustomDomain: false,
    hasAPIAccess: false,
  },
  pro: {
    maxForms: Infinity,
    maxLeadsPerMonth: 5000,
    maxWorkspaces: 5,
    maxEmailTemplates: Infinity,
    maxWebhookDestinations: 10,
    hasIPEnrichment: 'full',
    hasLeadScoring: true,
    hasWhiteLabel: false,
    hasCustomDomain: false,
    hasAPIAccess: true,
  },
  agency: {
    maxForms: Infinity,
    maxLeadsPerMonth: Infinity,
    maxWorkspaces: Infinity,
    maxEmailTemplates: Infinity,
    maxWebhookDestinations: Infinity,
    hasIPEnrichment: 'full',
    hasLeadScoring: true,
    hasWhiteLabel: true,
    hasCustomDomain: true,
    hasAPIAccess: true,
  },
}

export const STRIPE_PRICE_IDS: Record<Plan, string> = {
  starter: process.env.STRIPE_PRICE_STARTER!,
  pro: process.env.STRIPE_PRICE_PRO!,
  agency: process.env.STRIPE_PRICE_AGENCY!,
}

export const PLAN_PRICES_BRL: Record<Plan, number> = {
  starter: 97,
  pro: 247,
  agency: 597,
}

export const PLAN_NAMES: Record<Plan, string> = {
  starter: 'Starter',
  pro: 'Pro',
  agency: 'Agency',
}
