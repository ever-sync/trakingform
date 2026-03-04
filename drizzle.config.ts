import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // DIRECT_URL = session pooler (porta 5432) — pode estar bloqueada em algumas redes
    // Fallback para DATABASE_URL (porta 6543, transaction pooler)
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
})
