import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

let submitRatelimit: Ratelimit | null = null
let profileRatelimit: Ratelimit | null = null

function hasRedisEnv() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

/** Submissão pública: 10 req / minuto por form + IP */
export function getFormPublicRatelimit() {
  if (submitRatelimit) return submitRatelimit
  if (!hasRedisEnv()) return null

  submitRatelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, '1 m'),
  })
  return submitRatelimit
}

/** Progressive profiling: 20 req / minuto por form + IP */
export function getFormProfileRatelimit() {
  if (profileRatelimit) return profileRatelimit
  if (!hasRedisEnv()) return null

  profileRatelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(20, '1 m'),
  })
  return profileRatelimit
}
