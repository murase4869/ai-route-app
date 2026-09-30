// 同じ相手からの連続リクエストを制限する（API の無料枠を使い切られないため）

import type { MiddlewareHandler } from 'hono';

export function rateLimit({ max, windowMs }: { max: number; windowMs: number }): MiddlewareHandler {
  const hits = new Map<string, number[]>();

  return async (c, next) => {
    // Render では前段の中継サーバーが、本当の接続元IPを x-forwarded-for に入れてくれる
    const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const now = Date.now();
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);

    if (recent.length >= max) {
      const retryAfter = Math.ceil((windowMs - (now - recent[0])) / 1000);
      c.header('Retry-After', String(retryAfter));
      return c.json({ error: `リクエストが多すぎます。${retryAfter}秒後にもう一度お試しください。` }, 429);
    }

    recent.push(now);
    hits.set(ip, recent);
    await next();
  };
}
