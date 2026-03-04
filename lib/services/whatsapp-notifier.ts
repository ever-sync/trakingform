import { db } from '@/lib/db'
import { whatsappConfigs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

interface NotifyParams {
  workspaceId: string
  leadData: Record<string, unknown>
  score: number
}

function replaceTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return String(data[key] ?? '')
  })
}

export async function notifyWhatsApp({ workspaceId, leadData, score }: NotifyParams): Promise<boolean> {
  const configs = await db
    .select()
    .from(whatsappConfigs)
    .where(eq(whatsappConfigs.workspace_id, workspaceId))
    .limit(1)

  const config = configs[0]
  if (!config || !config.is_active) return false

  // Check minimum score
  if (score < (config.min_score ?? 70)) return false

  const message = replaceTemplate(
    config.message_template ?? 'Novo lead: {{name}} ({{email}}) - Score: {{score}}',
    { ...leadData, score: String(score) }
  )

  try {
    const url = `${config.api_url}/message/sendText/${config.instance_name}`

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.api_key,
      },
      body: JSON.stringify({
        number: config.notify_number,
        text: message,
      }),
    })

    return res.ok
  } catch (err) {
    console.error('[WhatsApp] Failed to send notification:', err)
    return false
  }
}
