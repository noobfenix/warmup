export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  maxTrackedClients?: number;
}

interface ClientRecord {
  count: number;
  resetAt: number;
}

export const ALLOWED_AUDIENCES = ["ward_officer", "housing_society", "school"] as const;
export type AllowedAudience = (typeof ALLOWED_AUDIENCES)[number];

export const ALLOWED_LANGUAGES = ["en", "hi", "mr", "ta"] as const;
export type AllowedLanguage = (typeof ALLOWED_LANGUAGES)[number];

export const ALLOWED_READING_LEVELS = ["executive", "standard", "accessible"] as const;
export type AllowedReadingLevel = (typeof ALLOWED_READING_LEVELS)[number];

export class InMemoryRateLimiter {
  private records = new Map<string, ClientRecord>();
  private windowMs: number;
  private maxRequests: number;
  private maxTrackedClients: number;

  constructor(
    options: RateLimiterOptions = {
      windowMs: 60_000,
      maxRequests: 60,
      maxTrackedClients: 5_000,
    }
  ) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
    this.maxTrackedClients = options.maxTrackedClients ?? 5_000;
  }

  public check(rawIdentifier: string): {
    allowed: boolean;
    remaining: number;
    resetAt: number;
  } {
    // Sanitize and bound identifier to prevent memory bloat attacks
    const identifier = (rawIdentifier || "127.0.0.1").trim().slice(0, 64);
    const now = Date.now();

    // Auto-prune when approaching capacity limit to prevent DoS memory exhaustion
    if (this.records.size >= this.maxTrackedClients * 0.8) {
      this.cleanup();
    }

    // Hard ceiling: drop oldest entries if still at or above maximum capacity
    if (this.records.size >= this.maxTrackedClients) {
      const keysToDelete = Array.from(this.records.keys()).slice(
        0,
        Math.max(1, Math.floor(this.maxTrackedClients * 0.2))
      );
      for (const k of keysToDelete) {
        this.records.delete(k);
      }
    }

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

  public size(): number {
    return this.records.size;
  }

  public getKeys(): IterableIterator<string> {
    return this.records.keys();
  }
}

// Global default rate limiter instance: 60 requests per minute per IP
export const apiRateLimiter = new InMemoryRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 60,
  maxTrackedClients: 5_000,
});

export const DEFAULT_MAX_BODY_BYTES = 100 * 1024; // 100 KB limit for standard payloads
export const BRIEF_MAX_BODY_BYTES = 250 * 1024; // 250 KB limit for brief generation

const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPV6_REGEX = /^[0-9a-fA-F:]+$/;

export function isValidIp(ip: string): boolean {
  if (!ip || ip.length > 45) return false;
  return IPV4_REGEX.test(ip) || IPV6_REGEX.test(ip);
}

export function getClientIp(req: Request): string {
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp && isValidIp(realIp)) {
    return realIp;
  }

  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ips = forwardedFor.split(",").map((s) => s.trim()).filter(Boolean);
    for (const ip of ips) {
      if (isValidIp(ip)) {
        return ip;
      }
    }
  }

  return "127.0.0.1";
}

/**
 * Generates restricted CORS headers validated against trusted origins.
 * Eliminates wildcard exposure on sensitive API endpoints.
 */
export function getCorsHeaders(
  req: Request,
  allowedMethods: string = "POST, OPTIONS"
): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const host = req.headers.get("host") || "";

  // Same-origin, loopback, or host-matching origin authorization
  const isAllowed =
    !origin ||
    origin.includes("localhost") ||
    origin.includes("127.0.0.1") ||
    (Boolean(host) && origin.includes(host)) ||
    (Boolean(process.env.ALLOWED_ORIGINS) &&
      process.env.ALLOWED_ORIGINS!.split(",").map((o) => o.trim()).includes(origin));

  return {
    "Access-Control-Allow-Origin": isAllowed ? (origin || "*") : "null",
    "Access-Control-Allow-Methods": allowedMethods,
    "Access-Control-Allow-Headers": "Content-Type, x-gemini-api-key",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin, Accept-Encoding, x-gemini-api-key",
  };
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

/**
 * Validates Gemini API key format to ensure safety against injection or malformed tokens.
 */
export function validateApiKeyFormat(apiKey: string | null | undefined): boolean {
  if (!apiKey || typeof apiKey !== "string") {
    return false;
  }
  const trimmed = apiKey.trim();
  // Valid API keys are between 20 and 128 characters, containing only alphanumeric, underscore, dot, or hyphen
  return /^[A-Za-z0-9_.-]{20,128}$/.test(trimmed);
}

/**
 * Sanitizes untrusted strings inserted into LLM prompt templates.
 * Strips raw newlines and control characters to prevent prompt injection / instruction override.
 */
export function sanitizePromptText(text: unknown, maxLen = 200): string {
  if (text === null || text === undefined) return "";
  const str = String(text);
  // Replace newlines, carriage returns, and control characters with a single space
  return str
    .replace(/[\r\n\t\x00-\x1F\x7F]+/g, " ")
    .trim()
    .slice(0, maxLen);
}

/**
 * Validates brief dissemination parameters strictly against allowed values.
 */
export function validateBriefParameters(params: {
  audience?: string;
  language?: string;
  readingLevel?: string;
}): {
  valid: boolean;
  params?: {
    audience: AllowedAudience;
    language: AllowedLanguage;
    readingLevel: AllowedReadingLevel;
  };
  error?: string;
} {
  const audience = (params.audience || "ward_officer") as AllowedAudience;
  if (!ALLOWED_AUDIENCES.includes(audience)) {
    return {
      valid: false,
      error: `Invalid audience "${params.audience}". Allowed: ${ALLOWED_AUDIENCES.join(", ")}`,
    };
  }

  const language = (params.language || "en") as AllowedLanguage;
  if (!ALLOWED_LANGUAGES.includes(language)) {
    return {
      valid: false,
      error: `Invalid language "${params.language}". Allowed: ${ALLOWED_LANGUAGES.join(", ")}`,
    };
  }

  const readingLevel = (params.readingLevel || "standard") as AllowedReadingLevel;
  if (!ALLOWED_READING_LEVELS.includes(readingLevel)) {
    return {
      valid: false,
      error: `Invalid readingLevel "${params.readingLevel}". Allowed: ${ALLOWED_READING_LEVELS.join(
        ", "
      )}`,
    };
  }

  return {
    valid: true,
    params: { audience, language, readingLevel },
  };
}

/**
 * Sanitizes CSV cell content against CSV/Formula Injection (DDE injection).
 * If an untrusted string begins with =, +, -, @, \t, or \r, prefixes it with a single quote
 * unless it is purely a standard signed numeric literal (e.g., -15.5 or +2).
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    const trimmed = str.trim();
    // Pure signed numeric values like -12 or +45.2 are safe mathematical numbers
    if (/^[+\-]\d+(\.\d+)?$/.test(trimmed)) {
      return trimmed;
    }
    return `'${str}`;
  }
  return str.trim();
}
