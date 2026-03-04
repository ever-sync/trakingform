# LeadForm

Aplicacao SaaS para criacao de formularios, captura de leads, disparo de webhooks e automacoes.

## Stack

- Next.js 16 + React 19
- Supabase Auth
- Drizzle ORM + PostgreSQL
- Upstash Redis (rate limit)
- Stripe (billing)
- Resend (e-mail)

## Setup local

1. Instale dependencias:
```bash
npm install
```

2. Crie o arquivo de ambiente:
```bash
cp .env.example .env
```

3. Preencha as variaveis no `.env`.

4. Rode o projeto:
```bash
npm run dev
```

## Scripts

- `npm run dev`: ambiente local
- `npm run build`: build de producao
- `npm run start`: executar build
- `npm run lint`: validacao de codigo

## Banco de dados

- Schema Drizzle: `lib/db/schema.ts`
- Config Drizzle: `drizzle.config.ts`
- Migracao inicial: `lib/db/migrations/0000_shallow_ezekiel.sql`
- Migracao "safe run" para Supabase SQL Editor: `lib/db/migrations/0000_safe_run.sql`

## Notas

- O projeto depende de servicos externos (Supabase, Redis, Stripe, Resend).
- Recomenda-se validar `npm run lint` e `npm run build` no CI antes de deploy.
