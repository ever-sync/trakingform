# LeadForm — AI-Powered Lead Capture & Management Platform

## Project Overview

SaaS platform for lead capture and management. Users can:
1. Build embeddable lead capture forms (drag-and-drop builder)
2. Manage captured leads in a built-in CRM
3. Enrich leads automatically with IP-based data (geolocation, device, ISP)
4. Send transactional/nurturing emails via customizable templates
5. Route leads to external systems via webhooks, n8n, WhatsApp, CRMs
6. View analytics: conversion rates, abandonment funnels, geo heatmaps
7. Manage multiple workspaces (agency model with white-label)

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL + Auth + Realtime) + Drizzle ORM
- **Cache / Rate Limiting**: Upstash Redis
- **Email Sending**: Resend
- **Payments**: Stripe
- **IP Enrichment**: ipinfo.io API
- **Styling**: Tailwind CSS + shadcn/ui
- **Charts**: Recharts
- **Form State**: React Hook Form + Zod
- **Drag & Drop**: @dnd-kit/core + @dnd-kit/sortable
- **Deployment**: Vercel

## Environment Variables Required
See `.env.example` for all required variables.

## Project Structure
```
app/
  (auth)/           # login, register
  (dashboard)/      # all protected routes
    dashboard/      # overview metrics
    forms/          # form builder + list
    leads/          # CRM view
    emails/         # templates + campaigns
    webhooks/       # destinations + logs
    analytics/      # charts
    workspace/      # settings + members
    billing/        # Stripe plans
  embed/[formId]/   # public embeddable form
  api/
    forms/[formId]/submit/  # PUBLIC: rate-limited submission endpoint
lib/
  db/               # Drizzle schema + migrations + queries
  supabase/         # client, server, middleware
  services/         # ip-enrichment, lead-score, webhook-dispatcher, email-sender, duplicate-detector
  stripe/           # client + plan definitions
  embed/            # snippet generator
  utils/            # format, constants
components/
  layout/           # Sidebar, Topbar
  ui/               # shadcn/ui (auto-generated)
types/index.ts      # all TypeScript interfaces
middleware.ts       # Next.js auth guard
```

## UI Design Guidelines
- Dark sidebar (#0f0f13) + white content area
- Accent color: #6366f1 (indigo)
- Font: Geist Sans
- Loading: skeleton screens (not spinners)
- Toasts: bottom-right via sonner, auto-dismiss 4s

## Implementation Priority
1. ✅ Auth + Workspace setup (Supabase auth pages done)
2. Form Builder (drag-and-drop — `app/(dashboard)/forms/[formId]/edit/page.tsx`)
3. Embed system (`app/embed/[formId]/page.tsx` — basic version done)
4. Leads CRM (table, filters, lead detail)
5. IP Enrichment (async, `lib/services/ip-enrichment.ts`)
6. Email Builder + Send
7. Webhooks
8. Analytics (Recharts)
9. Billing (Stripe)
10. White-label (agency plan)

## Key Services
- `lib/services/ip-enrichment.ts` — enriches lead with ipinfo.io + UA parser
- `lib/services/lead-score.ts` — scores 0-100 based on email, device, geo, VPN, duplicates
- `lib/services/webhook-dispatcher.ts` — async dispatch with exponential backoff retry (3 attempts)
- `lib/services/email-sender.ts` — Resend integration + block-based HTML rendering
- `lib/services/duplicate-detector.ts` — dedup by email, phone, fingerprint
- `lib/services/form-validator.ts` — server-side field validation

## Security
- All dashboard routes protected by middleware auth check
- Public submit endpoint: rate limited (Upstash) + honeypot + CORS headers
- Drizzle parameterized queries (no SQL injection)
- Stripe webhook signature must be verified

## Plans (lib/stripe/plans.ts)
- starter: 3 forms, 500 leads/mo, 1 workspace — R$97/mo
- pro: unlimited forms, 5000 leads/mo, 5 workspaces, lead scoring, API — R$247/mo
- agency: everything + white-label + custom domain — R$597/mo
