import { authenticate, charge, cors, GeoQuota, HttpError, json, PRIVATE_HEADERS, query, Upstream, type Env } from './security';
import { providerOperation } from './providers';
import { routingOperation } from './routing';

export { GeoQuota };
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    let headers: Record<string,string> = {};
    try {
      headers = cors(request,env);
      const url = new URL(request.url);
      if (url.href.length > 4096 || /%|\\|\/\//.test(url.pathname)) throw new HttpError(400, 'Invalid request path');
      if (request.method === 'OPTIONS') {
        query(url,[]);
        return new Response(null,{ status: 204, headers: { ...PRIVATE_HEADERS,...headers } });
      }
      if (request.method === 'GET' && url.pathname === '/health') {
        query(url,[]);
        return json({ ok: true, service: 'mymap-geo-gateway' },200,headers);
      }
      const uid = await authenticate(request,env);
      if (request.method !== 'GET' && request.method !== 'POST') throw new HttpError(405, 'Method is not allowed');
      const operation = request.method === 'POST' && url.pathname === '/route' ? await routingOperation(request,url,env) : await providerOperation(request,url,env);
      await charge(env,uid,operation.cost);
      const result = await operation.run(new Upstream(env));
      if ('bytes' in result && result.bytes) return new Response(result.bytes as BodyInit,{ headers: { ...PRIVATE_HEADERS,...headers,'Content-Type': result.contentType! } });
      return json(result.data,200,headers);
    } catch (error) {
      const failure = error instanceof HttpError ? error : new HttpError(502,'Service is temporarily unavailable');
      return json({ error: failure.message },failure.status,{ ...headers,...(failure.retryAfter ? { 'Retry-After': String(failure.retryAfter) } : {}) });
    }
  },
};
