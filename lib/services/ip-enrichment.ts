import { db } from '@/lib/db'
import { leadEnrichments, leadEvents } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { UAParser } from 'ua-parser-js'

export async function enrichLeadWithIP(leadId: string, ip: string, userAgent: string) {
  try {
    const [ipData, parsedUA] = await Promise.all([
      fetchIPData(ip),
      Promise.resolve(parseUserAgent(userAgent)),
    ])

    const enrichmentValues = {
      ip,
      city: ipData.city,
      region: ipData.region,
      country: ipData.country,
      country_code: ipData.country_code,
      latitude: ipData.latitude,
      longitude: ipData.longitude,
      timezone: ipData.timezone,
      isp: ipData.isp,
      org: ipData.org,
      is_vpn: ipData.privacy?.vpn ?? false,
      is_proxy: ipData.privacy?.proxy ?? false,
      is_hosting: ipData.privacy?.hosting ?? false,
      browser: parsedUA.browser.name ?? null,
      browser_version: parsedUA.browser.version ?? null,
      os: parsedUA.os.name ?? null,
      device_type: parsedUA.device.type || 'desktop',
      is_mobile: parsedUA.device.type === 'mobile',
      language: ipData.language ?? null,
      raw: ipData,
    }

    const inserted = await db
      .insert(leadEnrichments)
      .values({
        lead_id: leadId,
        ...enrichmentValues,
      })
      .onConflictDoNothing({ target: leadEnrichments.lead_id })
      .returning({ id: leadEnrichments.id })

    if (inserted.length > 0) {
      await db.insert(leadEvents).values({
        lead_id: leadId,
        type: 'enriched',
        description: `Lead enriquecido com IP (${ipData.city ?? '-'}, ${ipData.country ?? '-'})`,
        metadata: {
          city: ipData.city ?? null,
          country: ipData.country ?? null,
          browser: parsedUA.browser.name ?? null,
          device_type: parsedUA.device.type || 'desktop',
        },
      })
      return
    }

    await db
      .update(leadEnrichments)
      .set(enrichmentValues)
      .where(eq(leadEnrichments.lead_id, leadId))
  } catch (err) {
    console.error('IP enrichment failed:', err)
  }
}

async function fetchIPData(ip: string) {
  const res = await fetch(`https://ipinfo.io/${ip}/json?token=${process.env.IPINFO_TOKEN}`)
  return res.json()
}

function parseUserAgent(ua: string) {
  const parser = new UAParser(ua)
  return parser.getResult()
}
