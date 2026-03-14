const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || now > current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (current.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: current.resetAt - now };
  }

  current.count += 1;
  buckets.set(key, current);
  return { allowed: true, remaining: limit - current.count };
}
