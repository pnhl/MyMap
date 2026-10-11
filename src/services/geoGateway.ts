import {env} from '../config/env';
import {firebaseAuth, getFirebaseIdToken} from './firebase';

/** Only the public Worker address is bundled. Provider credentials stay in Worker bindings. */
export function gatewayUrl(path: string): string {
  const base = env.routingGatewayUrl.replace(/\/+$/, '');
  if (!base || !path.startsWith('/') || path.startsWith('//') || /[\\\r\n#]/.test(path)) throw new Error('Dịch vụ bản đồ chưa được cấu hình.');
  const pathname = path.split('?')[0]!;
  if (pathname.includes('..') || /%2e|%2f|%5c/i.test(pathname) || !/^\/(?:$|route$|stadia\/(?:tiles\/|static$)|tomtom\/(?:traffic\/(?:tiles\/|flow$)|search$|nearby$|reachable-range$|matrix$)|mapillary\/(?:tiles\/|graph\/|images\/)|cesium\/terrain\/)/.test(pathname)) throw new Error('Đường dẫn dịch vụ bản đồ không hợp lệ.');
  for (const name of new URLSearchParams(path.split('?')[1] || '').keys()) if (/^(?:key|api_?key|access_token|token|url|target|authorization)$/i.test(name)) throw new Error('Tham số dịch vụ bản đồ không hợp lệ.');
  const parsed = new URL(base);
  if (/[<>\"'`\s]/.test(base) || parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('Địa chỉ dịch vụ bản đồ không hợp lệ.');
  return base + path;
}

export function isGatewayUrl(url: string): boolean {
  try { const base = gatewayUrl('/'); if (!url.startsWith(base)) return false; return gatewayUrl(url.slice(base.length - 1)) === url; } catch { return false; }
}

export function gatewayCacheScope(): string { return firebaseAuth.currentUser?.uid ?? 'signed-out'; }

export class GatewayError extends Error {
  constructor(public readonly status: number, public readonly retryAfterSeconds = 0) {
    super(status === 429 ? 'Dịch vụ bản đồ đã đạt hạn mức. Hãy thử lại sau.' : status === 401 || status === 403 ? 'Hãy đăng nhập lại để dùng dịch vụ bản đồ.' : 'Dịch vụ bản đồ tạm thời chưa sẵn sàng.');
    this.name = 'GatewayError';
  }
}

const cooldowns = new Map<string, number>();

/** A login token is sent only to our exact gateway, in a header, with one refresh retry. */
async function authenticatedGatewayFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = gatewayUrl(path), owner = firebaseAuth.currentUser?.uid;
  if (!owner || firebaseAuth.currentUser?.isAnonymous) throw new GatewayError(401);
  const cooldownKey = `${owner}:${path.split('/')[1]}`, until = cooldowns.get(cooldownKey) || 0;
  if (until > Date.now()) throw new GatewayError(429, Math.ceil((until - Date.now()) / 1000));
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getFirebaseIdToken(attempt > 0);
    if (!token || firebaseAuth.currentUser?.uid !== owner) throw new GatewayError(401);
    const response = await fetch(url, {...init, redirect: 'error', headers: {...Object.fromEntries(new Headers(init.headers).entries()), Authorization: `Bearer ${token}`}});
    if (firebaseAuth.currentUser?.uid !== owner) throw new GatewayError(401);
    if (response.status === 401 && attempt === 0) continue;
    if (!response.ok) {
      const retryAfter = response.status === 429 ? Math.min(86400, Math.max(1, Number(response.headers.get('Retry-After')) || 60)) : 0;
      if (retryAfter) { cooldowns.set(cooldownKey, Date.now() + retryAfter * 1000); if (cooldowns.size > 40) cooldowns.delete(cooldowns.keys().next().value!); }
      throw new GatewayError(response.status, retryAfter);
    }
    return response;
  }
  throw new GatewayError(401);
}

export async function gatewayFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController(), abort = () => controller.abort();
  if (init.signal?.aborted) controller.abort();
  init.signal?.addEventListener('abort', abort, {once: true});
  const timer = setTimeout(abort, 25000);
  try { return await authenticatedGatewayFetch(path, {...init, signal: controller.signal}); }
  finally { clearTimeout(timer); init.signal?.removeEventListener('abort', abort); }
}
