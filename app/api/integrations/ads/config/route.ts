import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { adPlatformConfigs } from '@/lib/db/schema'
import { getRequestWorkspace } from '@/lib/api/auth-workspace'

const ALLOWED_PLATFORMS = new Set(['google_ads', 'meta_ads'])

export async function GET() {
  const { user, workspace } = await getRequestWorkspace()
  if (!user || !workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const configs = await db
    .select()
    .from(adPlatformConfigs)
    .where(eq(adPlatformConfigs.workspace_id, workspace.id))

  return NextResponse.json({ configs })
}

export async function PUT(req: NextRequest) {
  const { user, workspace } = await getRequestWorkspace()
  if (!user || !workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json()) as {
    platform?: string
    is_active?: boolean
    credentials?: Record<string, unknown>
    settings?: Record<string, unknown>
  }

  if (!body.platform || !ALLOWED_PLATFORMS.has(body.platform)) {
    return NextResponse.json({ error: 'Invalid platform' }, { status: 422 })
  }

  const [existing] = await db
    .select({ id: adPlatformConfigs.id })
    .from(adPlatformConfigs)
    .where(and(
      eq(adPlatformConfigs.workspace_id, workspace.id),
      eq(adPlatformConfigs.platform, body.platform as 'google_ads' | 'meta_ads')
    ))
    .limit(1)

  if (existing) {
    const [updated] = await db
      .update(adPlatformConfigs)
      .set({
        is_active: body.is_active ?? false,
        credentials: body.credentials ?? {},
        settings: body.settings ?? {},
        updated_at: new Date(),
      })
      .where(eq(adPlatformConfigs.id, existing.id))
      .returning()

    return NextResponse.json(updated)
  }

  const [created] = await db
    .insert(adPlatformConfigs)
    .values({
      workspace_id: workspace.id,
      platform: body.platform as 'google_ads' | 'meta_ads',
      is_active: body.is_active ?? false,
      credentials: body.credentials ?? {},
      settings: body.settings ?? {},
    })
    .returning()

  return NextResponse.json(created, { status: 201 })
}

