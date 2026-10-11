import { body, coordinate, HttpError, numeric, query, record, Upstream, boundedBytes, type Env } from './security';

type ProviderResponse = { data?: unknown; bytes?: Uint8Array; contentType?: string };
type Operation = { cost: number; run(upstream: Upstream): Promise<ProviderResponse> };
const styles = ['alidade_smooth_dark', 'alidade_smooth', 'outdoors', 'osm_bright'];
function tile(match: RegExpMatchArray, maxZoom = 20): string {
  const z = numeric(match[1], 0, maxZoom, true), x = numeric(match[2], 0, 2 ** z - 1, true), y = numeric(match[3], 0, 2 ** z - 1, true);
  return `${z}/${x}/${y}`;
}
function pointText(value: string | null): string {
  const parts = value?.split(',');
  if (parts?.length !== 2) throw new HttpError(400, 'A valid coordinate is required');
  return `${numeric(parts[0], -90, 90)},${numeric(parts[1], -180, 180)}`;
}
async function binary(upstream: Upstream, url: string | URL, kind: 'image' | 'vector' | 'terrain', init?: RequestInit): Promise<ProviderResponse> {
  const response = await upstream.fetch(url, init), actual = (response.headers.get('Content-Type') || '').split(';')[0]!.toLowerCase();
  const allowed = kind === 'image' ? ['image/png', 'image/jpeg', 'image/webp'] : kind === 'vector' ? ['application/vnd.mapbox-vector-tile', 'application/x-protobuf', 'application/octet-stream'] : ['application/vnd.quantized-mesh', 'application/octet-stream'];
  if (!allowed.includes(actual)) throw new HttpError(502, 'Provider returned an invalid response');
  return { bytes: await boundedBytes(response, kind === 'image' ? 8 * 1024 * 1024 : 4 * 1024 * 1024), contentType: kind === 'vector' ? 'application/vnd.mapbox-vector-tile' : actual };
}
function tomtomUrl(path: string, key: string, params: Record<string, string> = {}): URL {
  const url = new URL(`https://api.tomtom.com/${path}`);
  url.search = new URLSearchParams({ ...params, key }).toString(); return url;
}

export async function providerOperation(request: Request, url: URL, env: Env): Promise<Operation> {
  const path = url.pathname; let match: RegExpMatchArray | null;
  if (request.method === 'GET' && (match = path.match(/^\/stadia\/tiles\/([a-z_]+)\/(\d+)\/(\d+)\/(\d+)(@2x)?\.png$/))) {
    query(url, []); const style = match[1]!;
    if (!styles.includes(style)) throw new HttpError(400, 'Unsupported map style');
    const coords = tile([match[0]!, match[2]!, match[3]!, match[4]!] as RegExpMatchArray);
    const suffix = match[5] || '';
    return { cost: 1, run: async up => binary(up, `https://tiles.stadiamaps.com/tiles/${style}/${coords}${suffix}.png?${new URLSearchParams({ api_key: await up.secret('STADIA_KEY') })}`, 'image') };
  }
  if (request.method === 'GET' && path === '/stadia/static') {
    const params = query(url, ['center', 'zoom', 'size', 'style']), center = pointText(params.get('center'));
    const zoom = numeric(params.get('zoom'), 0, 20), size = params.get('size')?.match(/^(\d+)x(\d+)(@2x)?$/);
    if (!size) throw new HttpError(400, 'Invalid static map size');
    const width = numeric(size[1], 1, 1024, true), height = numeric(size[2], 1, 1024, true), style = params.get('style') || 'alidade_smooth_dark';
    if (!styles.includes(style)) throw new HttpError(400, 'Unsupported map style');
    return { cost: 5, run: async up => binary(up, `https://tiles.stadiamaps.com/static/${style}.png?${new URLSearchParams({ center, zoom: String(zoom), size: `${width}x${height}${size[3] || ''}`, api_key: await up.secret('STADIA_KEY') })}`, 'image') };
  }
  if (request.method === 'GET' && (match = path.match(/^\/tomtom\/traffic\/tiles\/(\d+)\/(\d+)\/(\d+)\.png$/))) {
    query(url, []); const coords = tile(match, 18);
    return { cost: 1, run: async up => binary(up, tomtomUrl(`traffic/map/4/tile/flow/relative0/${coords}.png`, await up.secret('TOMTOM_KEY'), { tileSize: '256' }), 'image') };
  }
  if (request.method === 'GET' && path === '/tomtom/traffic/flow') {
    const params = query(url, ['point']), point = pointText(params.get('point'));
    return { cost: 3, run: async up => ({ data: up.redact(await up.json(tomtomUrl('traffic/services/4/flowSegmentData/relative0/16/json', await up.secret('TOMTOM_KEY'), { point, unit: 'kmph' }))) }) };
  }
  if (request.method === 'GET' && (path === '/tomtom/search' || path === '/tomtom/nearby')) {
    const nearby = path.endsWith('/nearby'), params = query(url, ['query', 'lat', 'lon', 'radius', 'limit', 'typeahead', 'categorySet']);
    const output: Record<string, string> = { language: 'vi-VN', limit: String(numeric(params.get('limit') || (nearby ? 40 : 10), 1, 40, true)) };
    if (nearby || params.has('lat') || params.has('lon')) { output.lat = String(numeric(params.get('lat'), -90, 90)); output.lon = String(numeric(params.get('lon'), -180, 180)); }
    if (nearby || params.has('radius')) output.radius = String(numeric(params.get('radius') || 2000, 1, 10000, true));
    if (params.has('categorySet')) {
      const categories = (params.get('categorySet') || '').split(',');
      if (!categories.length || categories.length > 10 || categories.some(category => !['7311','7315','9376','7326','7321','7369','7313','7309'].includes(category))) throw new HttpError(400, 'Unsupported search category');
      output.categorySet = categories.join(',');
    }
    if (params.has('typeahead') && params.get('typeahead') !== 'true' && params.get('typeahead') !== 'false') throw new HttpError(400, 'Invalid search parameter');
    if (params.has('typeahead')) output.typeahead = params.get('typeahead')!;
    const term = params.get('query')?.trim() || '';
    if (!nearby && (term.length < 2 || term.length > 200 || /[\u0000-\u001f]/.test(term))) throw new HttpError(400, 'A search query between 2 and 200 characters is required');
    if (nearby && (params.has('query') || params.has('typeahead'))) throw new HttpError(400, 'Unsupported nearby search parameters');
    return { cost: 5, run: async up => ({ data: up.redact(await up.json(tomtomUrl(nearby ? 'search/2/nearbySearch/.json' : `search/2/search/${encodeURIComponent(term)}.json`, await up.secret('TOMTOM_KEY'), output))) }) };
  }
  if (request.method === 'POST' && path === '/tomtom/reachable-range') {
    query(url, []); const input = record(await body(request), ['origin', 'minutes', 'mode']), origin = coordinate(input.origin);
    if (![10, 15, 30, 45, 60].includes(input.minutes) || !['car','motorbike'].includes(input.mode)) throw new HttpError(400, 'Invalid reachable range parameters');
    return { cost: 20, run: async up => ({ data: up.redact(await up.json(tomtomUrl(`routing/1/calculateReachableRange/${origin.latitude},${origin.longitude}/json`, await up.secret('TOMTOM_KEY'), { timeBudgetInSec: String(input.minutes * 60), travelMode: input.mode === 'motorbike' ? 'motorcycle' : 'car', routeType: 'fastest', traffic: 'true', departAt: 'now' }))) }) };
  }
  if (request.method === 'POST' && path === '/tomtom/matrix') {
    query(url, []); const input = record(await body(request), ['origins','destinations','options']);
    function points(value: unknown) {
      if (!Array.isArray(value) || !value.length || value.length > 5) throw new HttpError(400, 'Matrix requires 1 to 5 origins and destinations');
      return value.map(item => ({ point: coordinate(record(item, ['point']).point) }));
    }
    const origins = points(input.origins), destinations = points(input.destinations);
    if (input.options) {
      const options = record(input.options, ['routeType','travelMode','departAt','traffic']);
      if (Object.entries(options).some(([key, value]) => value !== ({ routeType: 'fastest', travelMode: 'car', departAt: 'now', traffic: 'live' } as Record<string,string>)[key])) throw new HttpError(400, 'Unsupported matrix options');
    }
    const all = [...origins,...destinations].map(item => item.point), lats = all.map(p => p.latitude), lons = all.map(p => p.longitude);
    if ((Math.max(...lats) - Math.min(...lats)) * 111320 > 390000 || (Math.max(...lons) - Math.min(...lons)) * 111320 * Math.cos((Math.max(...lats) + Math.min(...lats)) / 2 * Math.PI / 180) > 390000) throw new HttpError(400, 'Matrix points must be within a 390 km region');
    return { cost: Math.max(10, origins.length * destinations.length * 3), run: async up => ({ data: up.redact(await up.json(tomtomUrl('routing/matrix/2', await up.secret('TOMTOM_KEY')), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ origins, destinations, options: { routeType: 'fastest', travelMode: 'car', departAt: 'now', traffic: 'live' } }) })) }) };
  }
  if (request.method === 'GET' && (match = path.match(/^\/mapillary\/tiles\/(\d+)\/(\d+)\/(\d+)\.mvt$/))) {
    query(url, []); const coords = tile(match, 14);
    if (!coords.startsWith('14/')) throw new HttpError(400, 'Mapillary coverage requires zoom 14');
    return { cost: 2, run: async up => binary(up, `https://tiles.mapillary.com/maps/vtp/mly1_public/2/${coords}?${new URLSearchParams({ access_token: await up.secret('MAPILLARY_TOKEN') })}`, 'vector') };
  }
  if (request.method === 'GET' && (match = path.match(/^\/mapillary\/graph\/(map_features|\d{1,30}(?:\/detections)?)$/))) {
    const graphPath = match[1]!, params = query(url, ['fields', 'bbox', 'limit']), fields = params.get('fields')?.split(',') || [];
    const allowed = graphPath === 'map_features' ? ['id','geometry','object_value','object_type','first_seen_at','last_seen_at'] : graphPath.endsWith('/detections') ? ['id','value'] : ['id','geometry','computed_geometry','captured_at','thumb_1024_url','creator','images'];
    if (!fields.length || fields.length > allowed.length || fields.some(field => !allowed.includes(field)) || new Set(fields).size !== fields.length) throw new HttpError(400, 'Unsupported Mapillary fields');
    const output: Record<string,string> = { fields: fields.join(',') };
    if (params.has('limit')) output.limit = String(numeric(params.get('limit'), 1, 100, true));
    if (graphPath === 'map_features') {
      const bbox = params.get('bbox')?.split(',');
      if (bbox?.length !== 4) throw new HttpError(400, 'A bounded Mapillary bbox is required');
      const west = numeric(bbox[0], -180,180), south = numeric(bbox[1],-90,90), east = numeric(bbox[2],-180,180), north = numeric(bbox[3],-90,90);
      if (east <= west || north <= south || east-west > 0.25 || north-south > 0.05) throw new HttpError(400, 'Mapillary bbox is too large');
      output.bbox = [west,south,east,north].join(','); output.limit ||= '100';
    } else if (params.has('bbox')) throw new HttpError(400, 'Unsupported Mapillary parameters');
    return { cost: 5, run: async up => {
      const data = await up.json(`https://graph.mapillary.com/${graphPath}?${new URLSearchParams(output)}`, { headers: { Authorization: `OAuth ${await up.secret('MAPILLARY_TOKEN')}` } });
      const cleaned = up.redact(data);
      function thumbnails(raw: any, safe: any) {
        if (Array.isArray(raw)) { raw.forEach((item,index) => thumbnails(item,safe?.[index])); return; }
        if (!raw || typeof raw !== 'object' || !safe || typeof safe !== 'object') return;
        if (/^\d{1,30}$/.test(String(raw.id)) && typeof raw.thumb_1024_url === 'string') safe.thumb_1024_url = `${url.origin}/mapillary/images/${raw.id}?size=1024`;
        for (const key of Object.keys(safe)) if (key !== 'thumb_1024_url') thumbnails(raw[key],safe[key]);
      }
      thumbnails(data,cleaned); return { data: cleaned };
    } };
  }
  if (request.method === 'GET' && (match = path.match(/^\/mapillary\/images\/(\d{1,30})$/))) {
    const params = query(url, ['size']), id = match[1]!;
    if (params.get('size') !== '1024') throw new HttpError(400, 'Unsupported image size');
    return { cost: 8, run: async up => {
      const metadata = await up.json(`https://graph.mapillary.com/${id}?fields=thumb_1024_url`, { headers: { Authorization: `OAuth ${await up.secret('MAPILLARY_TOKEN')}` } });
      let image: URL;
      try { image = new URL(metadata.thumb_1024_url); } catch { throw new HttpError(502, 'Image is temporarily unavailable'); }
      // Only the signed image returned by Graph can be relayed. No caller URLs or redirects.
      if (image.protocol !== 'https:' || image.username || image.password || image.port || !(image.hostname.endsWith('.fbcdn.net') || image.hostname.endsWith('.fbsbx.com'))) throw new HttpError(502, 'Image is temporarily unavailable');
      return binary(up, image, 'image');
    } };
  }
  if (request.method === 'GET' && (path === '/cesium/terrain/layer.json' || (match = path.match(/^\/cesium\/terrain\/(\d+)\/(\d+)\/(\d+)\.terrain$/)))) {
    const params = query(url, ['v']);
    if (params.has('v') && !/^[A-Za-z0-9._-]{1,64}$/.test(params.get('v')!)) throw new HttpError(400, 'Invalid terrain version');
    // Cesium's ordinary Resource sends extensions in Accept, while Ion uses a
    // query parameter. Translate only supported extension names at this boundary.
    const accept = request.headers.get('Accept') || '';
    if (accept.length > 512) throw new HttpError(400, 'Invalid terrain extensions');
    const extensionHeaders = [...accept.matchAll(/(?:^|[,;])\s*extensions\s*=\s*([^;,\s]+)/gi)];
    const extensions = extensionHeaders.length ? extensionHeaders[0]![1]!.split('-') : [];
    if (extensionHeaders.length > 1 || extensions.length > 3 || new Set(extensions).size !== extensions.length || extensions.some(value => !['metadata','octvertexnormals','watermask'].includes(value))) throw new HttpError(400, 'Unsupported terrain extensions');
    let relative = 'layer.json';
    if (!path.endsWith('/layer.json')) {
      // Cesium world terrain uses EPSG:4326: two columns and one row at level zero.
      const z = numeric(match![1],0,20,true), x = numeric(match![2],0,2 ** (z + 1) - 1,true), y = numeric(match![3],0,2 ** z - 1,true);
      relative = `${z}/${x}/${y}.terrain`;
    }
    return { cost: 2, run: async up => {
      const endpoint = await up.json('https://api.cesium.com/v1/assets/1/endpoint', { headers: { Authorization: `Bearer ${await up.secret('CESIUM_ION_TOKEN')}` } });
      let base: URL;
      try { base = new URL(endpoint.url); } catch { throw new HttpError(502, 'Terrain is temporarily unavailable'); }
      if (base.origin !== 'https://assets.cesium.com' || base.pathname !== '/1/' || base.search || base.username || base.password || typeof endpoint.accessToken !== 'string') throw new HttpError(502, 'Terrain is temporarily unavailable');
      up.remember(endpoint.accessToken);
      const terrain = new URL(relative, base); if (params.has('v')) terrain.searchParams.set('v',params.get('v')!);
      if (relative !== 'layer.json' && extensions.length) terrain.searchParams.set('extensions',extensions.join('-'));
      const headers = { Authorization: `Bearer ${endpoint.accessToken}`, Accept: 'application/vnd.quantized-mesh,application/json' };
      if (relative !== 'layer.json') return binary(up, terrain, 'terrain', { headers });
      const raw = await up.json(terrain, { headers }), safe = up.redact(raw);
      // Remove all upstream URL-bearing metadata, including endpoint temporary tokens.
      delete safe.parentUrl; delete safe.extensionsUrl; delete safe.accessToken;
      safe.tiles = [`${url.origin}/cesium/terrain/{z}/{x}/{y}.terrain?v={version}`];
      return { data: safe };
    } };
  }
  throw new HttpError(404, 'Not found');
}
