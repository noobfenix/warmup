export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
}

interface ClientRecord {
  count: number;
  resetAt: number;
}

export class InMemoryRateLimiter {
  private records = new Map<string, ClientRecord>();
  private windowMs: number;
  private maxRequests: number;

  constructor(options: RateLimiterOptions = { windowMs: 60_000, maxRequests: 60 }) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
  }

  public check(identifier: string): {
    allowed: boolean;
    remaining: number;
    resetAt: number;
  } {
    const now = Date.now();
    const record = this.records.get(identifier);

    if (!record || now > record.resetAt) {
      const resetAt = now + this.windowMs;
      this.records.set(identifier, { count: 1, resetAt });
      return { allowed: true, remaining: this.maxRequests - 1, resetAt };
    }

    if (record.count >= this.maxRequests) {
      return { allowed: false, remaining: 0, resetAt: record.resetAt };
    }

    record.count += 1;
    return {
      allowed: true,
      remaining: this.maxRequests - record.count,
      resetAt: record.resetAt,
    };
  }

  public cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.records.entries()) {
      if (now > value.resetAt) {
        this.records.delete(key);
      }
    }
  }

  public reset(): void {
    this.records.clear();
  }
}

// Global default rate limiter instance: 60 requests per minute per IP
export const apiRateLimiter = new InMemoryRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 60,
});

export const DEFAULT_MAX_BODY_BYTES = 100 * 1024; // 100 KB limit for standard payloads

export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
}

export async function parseJsonWithLimit<T = unknown>(
  req: Request,
  maxBytes: number = DEFAULT_MAX_BODY_BYTES
): Promise<{ data?: T; error?: string; status?: number }> {
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    return {
      error: `Payload exceeds maximum allowed size of ${maxBytes} bytes`,
      status: 413,
    };
  }

  const rawBody = await req.text();
  const byteLength = new TextEncoder().encode(rawBody).length;

  if (byteLength > maxBytes) {
    return {
      error: `Payload exceeds maximum allowed size of ${maxBytes} bytes`,
      status: 413,
    };
  }

  try {
    const parsed = JSON.parse(rawBody) as T;
    return { data: parsed };
  } catch {
    return {
      error: "Invalid JSON syntax",
      status: 400,
    };
  }
}
