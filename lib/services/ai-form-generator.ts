import { FormField } from '@/types'

const SYSTEM_PROMPT = `Você é um gerador de formulários de captura de leads.
Dado uma descrição do negócio/objetivo, gere campos de formulário otimizados para maximizar conversões.

Regras:
- Retorne APENAS um array JSON válido de campos
- Cada campo deve ter: id (uuid), type, name, label, placeholder, required, options (se select/radio/checkbox)
- Types válidos: text, email, phone, select, radio, checkbox, date, textarea, hidden
- Sempre inclua campo de email como obrigatório
- Campo de nome deve ser o primeiro
- Use nomes em snake_case para o campo "name"
- Labels e placeholders em português brasileiro
- Máximo 8 campos visíveis
- Otimize para conversão: menos campos = mais conversões
- Para select/radio/checkbox, inclua array de options com {label, value}

Exemplo de saída:
[
  {"id":"uuid1","type":"text","name":"name","label":"Seu nome","placeholder":"Digite seu nome completo","required":true},
  {"id":"uuid2","type":"email","name":"email","label":"E-mail","placeholder":"seu@email.com","required":true}
]`

export async function generateFormFields(description: string): Promise<FormField[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Gere os campos de formulário para: ${description}`,
        },
      ],
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Claude API error: ${error}`)
  }

  const data = await res.json() as {
    content: { type: string; text: string }[]
  }

  const text = data.content[0]?.text ?? '[]'

  // Extract JSON array from response
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('Failed to parse AI response')

  const fields = JSON.parse(jsonMatch[0]) as FormField[]

  // Ensure all fields have valid IDs
  return fields.map(field => ({
    ...field,
    id: field.id || crypto.randomUUID(),
    required: field.required ?? false,
  }))
}
