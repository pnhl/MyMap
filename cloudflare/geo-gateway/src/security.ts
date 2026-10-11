export type Secret = string | { get(): Promise<string> };
export interface Env {
  ALLOWED_ORIGINS?: string;
  FIREBASE_PROJECT_ID?: string;
  ROUTING_PROVIDERS?: string;
  STADIA_KEY?: Secret;
  TOMTOM_KEY?: Secret;
  MAPILLARY_TOKEN?: Secret;
  GRAPHHOPPER_KEY?: Secret;
  CESIUM_ION_TOKEN?: Secret;
  GEO_QUOTA: DurableObjectNamespace;
}

export class HttpError extends Error {
  constructor(readonly status: number, message: string, readonly retryAfter?: number) { super(message); }
}

export const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

export function cors(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (origin && !allowed.includes(origin)) throw new HttpError(403, 'Origin is not allowed');
  return {
    ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
    'Access-Control-Expose-Headers': 'Retry-After',
    'Access-Control-Max-Age': '600', Vary: 'Origin',
  };
}

export function json(value: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(value), { status, headers: { ...PRIVATE_HEADERS, 'Content-Type': 'application/json; charset=utf-8', ...headers } });
}

const GOOGLE_JWKS = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let jwksCache: { keys: (JsonWebKey & { kid?: string })[]; until: number } | undefined;
let jwksPending: Promise<(JsonWebKey & { kid?: string })[]> | undefined;
let lastJwksFetch = 0;
async function googleKeys(refresh = false): Promise<(JsonWebKey & { kid?: string })[]> {
  if (refresh && Date.now() - lastJwksFetch >= 60000) jwksCache = undefined;
  if (jwksCache && jwksCache.until > Date.now()) return jwksCache.keys;
  if (jwksPending) return jwksPending;
  jwksPending = (async () => {
    lastJwksFetch = Date.now();
    const response = await fetch(GOOGLE_JWKS, { redirect: 'error', signal: AbortSignal.timeout(5000), headers: { Accept: 'application/json' } });
    if (!response.ok) throw new HttpError(503, 'Authentication is temporarily unavailable');
    const data = await response.json() as { keys?: (JsonWebKey & { kid?: string })[] };
    if (!Array.isArray(data.keys) || !data.keys.length || data.keys.length > 10) throw new HttpError(503, 'Authentication is temporarily unavailable');
    const seconds = Math.min(21600, Math.max(60, Number(response.headers.get('Cache-Control')?.match(/max-age=(\d+)/)?.[1] || 300)));
    jwksCache = { keys: data.keys, until: Date.now() + seconds * 1000 };
    return data.keys;
  })();
  try { return await jwksPending; } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(503, 'Authentication is temporarily unavailable');
  } finally { jwksPending = undefined; }
}

function decodeBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new HttpError(401, 'A valid Firebase ID token is required');
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}

export async function authenticate(request: Request, env: Env): Promise<string> {
  if (!env.FIREBASE_PROJECT_ID || !/^[a-z][a-z0-9-]{4,62}$/.test(env.FIREBASE_PROJECT_ID)) throw new HttpError(503, 'Authentication is not configured');
  const authorization = request.headers.get('Authorization') || '';
  if (!/^Bearer [A-Za-z0-9_.-]+$/.test(authorization) || authorization.length > 8192) throw new HttpError(401, 'A valid Firebase ID token is required');
  try {
    const parts = authorization.slice(7).split('.');
    if (parts.length !== 3) throw new Error();
    const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0]!)));
    const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1]!)));
    const now = Math.floor(Date.now() / 1000);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || header.kid.length > 128 || header.crit !== undefined) throw new Error();
    if (claims.aud !== env.FIREBASE_PROJECT_ID || claims.iss !== `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`
      || typeof claims.sub !== 'string' || !claims.sub.length || claims.sub.length > 128
      || !Number.isInteger(claims.exp) || claims.exp <= now
      || !Number.isInteger(claims.iat) || claims.iat > now + 30
      || !Number.isInteger(claims.auth_time) || claims.auth_time > now + 30
      || claims.exp <= claims.iat || (claims.nbf !== undefined && (!Number.isInteger(claims.nbf) || claims.nbf > now + 30))
      || !claims.firebase || typeof claims.firebase.sign_in_provider !== 'string'
      || claims.firebase.sign_in_provider === 'anonymous') throw new Error();
    // Only Google's fixed JWKS endpoint is trusted; caller jku/x5u URLs are never fetched.
    const matchingKey = (keys: (JsonWebKey & { kid?: string })[]) => keys.find(key => key.kid === header.kid && key.kty === 'RSA' && (!key.alg || key.alg === 'RS256'));
    const jwk = matchingKey(await googleKeys()) || matchingKey(await googleKeys(true));
    if (!jwk) throw new Error();
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decodeBase64Url(parts[2]!), new TextEncoder().encode(`${parts[0]}.${parts[1]}`))) throw new Error();
    return claims.sub;
  } catch (error) {
    if (error instanceof HttpError && error.status === 503) throw error;
    throw new HttpError(401, 'A valid Firebase ID token is required');
  }
}

type Counter = { minute: number; minuteUnits: number; day: number; dayUnits: number };
export class GeoQuota {
  constructor(private state: DurableObjectState) {}
  async fetch(request: Request): Promise<Response> {
    const data = await request.json() as { cost: number; global?: boolean };
    if (!Number.isInteger(data.cost) || data.cost < 1 || data.cost > 100) return json({ error: 'Invalid quota operation' }, 400);
    const now = Math.floor(Date.now() / 1000), minute = Math.floor(now / 60), day = Math.floor(now / 86400);
    // A single fixed record per object: no UID, coordinates, tokens, or request history persisted.
    const retryAfter = await this.state.storage.transaction(async storage => {
      const previous = await storage.get<Counter>('quota');
      const current: Counter = { minute, minuteUnits: previous?.minute === minute ? previous.minuteUnits : 0, day, dayUnits: previous?.day === day ? previous.dayUnits : 0 };
      const minuteLimit = data.global ? 3000 : 240, dayLimit = data.global ? 50000 : 5000;
      if (current.dayUnits + data.cost > dayLimit) return (day + 1) * 86400 - now;
      if (current.minuteUnits + data.cost > minuteLimit) return (minute + 1) * 60 - now;
      current.minuteUnits += data.cost; current.dayUnits += data.cost;
      await storage.put('quota', current);
      if (!await storage.getAlarm()) await storage.setAlarm((day + 2) * 86400000);
      return 0;
    });
    return json({ allowed: retryAfter === 0, retryAfter });
  }
  async alarm(): Promise<void> { await this.state.storage.deleteAll(); }
}

export async function charge(env: Env, uid: string, cost: number): Promise<void> {
  if (!env.GEO_QUOTA) throw new HttpError(503, 'Request quota is not configured');
  for (const global of [false, true]) {
    const id = env.GEO_QUOTA.idFromName(global ? 'aggregate:v1' : `uid:v1:${uid}`);
    let response: Response;
    try { response = await env.GEO_QUOTA.get(id).fetch('https://quota.internal/consume', { method: 'POST', body: JSON.stringify({ cost, global }) }); }
    catch { throw new HttpError(503, 'Request quota is temporarily unavailable'); }
    if (!response.ok) throw new HttpError(503, 'Request quota is temporarily unavailable');
    const result = await response.json() as { allowed: boolean; retryAfter: number };
    if (result.allowed !== true) throw new HttpError(429, 'Request quota exceeded. Try again later.', Math.max(1, Math.ceil(result.retryAfter || 60)));
  }
}

export function record(value: unknown, keys: string[]): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw new HttpError(400, 'Unsupported request fields');
  return value as Record<string, any>;
}
export function query(url: URL, keys: string[]): URLSearchParams {
  const seen = new Set<string>();
  for (const key of url.searchParams.keys()) {
    if (!keys.includes(key) || seen.has(key)) throw new HttpError(400, 'Unsupported query parameters');
    seen.add(key);
  }
  return url.searchParams;
}
export function numeric(value: unknown, min: number, max: number, integer = false): number {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^-?\d+(?:\.\d+)?$/.test(value))) throw new HttpError(400, 'Invalid numeric parameter');
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max || (integer && !Number.isInteger(number))) throw new HttpError(400, 'Invalid numeric parameter');
  return number;
}
export type Coordinate = { latitude: number; longitude: number };
export function coordinate(value: unknown): Coordinate {
  const point = record(value, ['latitude', 'longitude']);
  return { latitude: numeric(point.latitude, -90, 90), longitude: numeric(point.longitude, -180, 180) };
}
export async function body(request: Request): Promise<Record<string, any>> {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) throw new HttpError(415, 'A JSON request body is required');
  if (Number(request.headers.get('Content-Length') || 0) > 16384) throw new HttpError(413, 'Request body is too large');
  const text = await boundedText(request, 16384);
  try { return JSON.parse(text); } catch { throw new HttpError(400, 'Invalid JSON body'); }
}
async function boundedText(source: Request | Response, max: number): Promise<string> {
  return new TextDecoder().decode(await boundedBytes(source, max));
}
export async function boundedBytes(source: Request | Response, max: number): Promise<Uint8Array> {
  if (Number(source.headers.get('Content-Length') || 0) > max) throw new HttpError(source instanceof Request ? 413 : 502, 'Payload is too large');
  const reader = source.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > max) { await reader.cancel(); throw new HttpError(source instanceof Request ? 413 : 502, 'Payload is too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const output = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
}

export class Upstream {
  private values: string[] = [];
  private readonly deadline = Date.now() + 25000;
  constructor(private env: Env) {}
  remember(value: string): void { this.values.push(value,encodeURIComponent(value)); }
  async secret(name: 'STADIA_KEY' | 'TOMTOM_KEY' | 'MAPILLARY_TOKEN' | 'GRAPHHOPPER_KEY' | 'CESIUM_ION_TOKEN'): Promise<string> {
    const binding = this.env[name];
    let value: string | undefined;
    try { value = typeof binding === 'string' ? binding : await binding?.get(); } catch { /* Fail closed without exposing a binding error. */ }
    if (!value?.trim()) throw new HttpError(503, 'This provider is not configured');
    this.remember(value);
    return value;
  }
  async fetch(url: string | URL, init: RequestInit = {}): Promise<Response> {
    try {
      const remaining = this.deadline - Date.now();
      if (remaining <= 0) throw new HttpError(502, 'Provider is temporarily unavailable');
      const response = await fetch(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(Math.min(20000, remaining)) });
      if (response.status === 429) throw new HttpError(429, 'Provider quota exceeded. Try again later.', Math.min(86400, Math.max(1, Number(response.headers.get('Retry-After')) || 60)));
      if (!response.ok) throw new HttpError(502, 'Provider is temporarily unavailable');
      return response;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(502, 'Provider is temporarily unavailable');
    }
  }
  async json(url: string | URL, init: RequestInit = {}): Promise<any> {
    const response = await this.fetch(url, { ...init, headers: { Accept: 'application/json', ...init.headers } });
    try { return JSON.parse(await boundedText(response, 4 * 1024 * 1024)); }
    catch { throw new HttpError(502, 'Provider returned an invalid response'); }
  }
  redact(value: unknown): any {
    if (Array.isArray(value)) return value.map(item => this.redact(item));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !/^(?:key|api_key|access_token|token|authorization|paging|links|url|thumb_\d+_url)$/i.test(key)).map(([key, item]) => [key, this.redact(item)]));
    if (typeof value === 'string') {
      if (/https?:\/\//i.test(value)) return '[upstream URL removed]';
      for (const secret of this.values) if (secret) value = (value as string).split(secret).join('[redacted]');
    }
    return value;
  }
}
