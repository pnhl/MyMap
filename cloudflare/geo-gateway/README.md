# MyMap Geo Gateway

Authenticated Cloudflare proxy for shared iOS, Google Android and Amazon clients.
Provider credentials exist only in Worker secret bindings. `GET /health` returns
only service status, without reading a secret or calling a provider.

All data routes verify a non-anonymous Firebase ID token (RS256 signature,
issuer, audience, expiry) from `Authorization: Bearer …`. Never send it in URLs.
Allowed CORS origins are the native WebView base `https://app.mymap.local` and
Android's opaque `null` origin; both still require authentication. Add exact web
origins to `ALLOWED_ORIGINS` if needed. Native requests without Origin are allowed.

| Route | Method | Units |
|---|---|---|
| `/route` | POST | 20 |
| `/stadia/tiles/<style>/<z>/<x>/<y>[@2x].png` | GET | 1 |
| `/stadia/static` | GET | 5 |
| `/tomtom/traffic/tiles/<z>/<x>/<y>.png` | GET | 1 |
| `/tomtom/traffic/flow` | GET | 3 |
| `/tomtom/search`, `/tomtom/nearby` | GET | 5 |
| `/tomtom/reachable-range` | POST | 20 |
| `/tomtom/matrix` | POST | max(10, origins × destinations × 3) |
| `/mapillary/tiles/14/<x>/<y>.mvt` | GET | 2 |
| `/mapillary/graph/<id or map_features or id/detections>` | GET | 5 |
| `/mapillary/images/<id>?size=1024` | GET | 8 |
| `/cesium/terrain/layer.json`, `/cesium/terrain/<z>/<x>/<y>.terrain` | GET | 2 |

Every route validates path, method, parameters and bounded payloads before any
upstream request. No caller-supplied upstream URL or redirect is followed.
Routing preserves instructions, lanes, traffic, alternatives and avoidance.
Mapillary signed image URLs and Cesium's asset token stay server-side. Cesium
relays only fixed asset 1. Responses and logs never include provider credentials;
request observability is disabled and responses are private/no-store.

Durable Object `GEO_QUOTA` persists weighted counters per UID (240/minute,
5,000/UTC day) and aggregate (3,000/minute, 50,000/UTC day). It stores counters,
not location history or tokens. Quota/provider exhaustion returns 429 with
`Retry-After`; authentication errors return 401, denied origin 403, bad input
400, missing provider configuration 503 and sanitized upstream failure 502.
Set provider account spending limits separately.

From the repository root:

```sh
npm ci --prefix cloudflare/geo-gateway
npm run check --prefix cloudflare/geo-gateway
node --test tests/geo-gateway-security.test.cjs
npm run deploy --prefix cloudflare/geo-gateway
```

The dry run explicitly loads the empty checked-in `wrangler.check.env`, avoiding
private `.dev.vars`/`.env`. Deployment uses your existing Wrangler login. Confirm
public `FIREBASE_PROJECT_ID`, CORS origins, provider secret bindings and the
`geo-quota-v1` Durable Object migration before deploying. Optional ordinary Worker
secrets are `GRAPHHOPPER_KEY` and `CESIUM_ION_TOKEN`; never put them in `vars`.
Secret Store names, rotation instructions and health-only production checks are
documented in [BUILD.md](../../docs/BUILD.md).

Set only `EXPO_PUBLIC_ROUTING_GATEWAY_URL` in the mobile public configuration.
Guests use public OSM sources. Run the post-build credential scan on Metro/Hermes
bundles and native artifacts before shipping; no provider key belongs in Expo.
