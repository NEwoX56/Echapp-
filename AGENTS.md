# Base44 dev environment — ÉCHAPPÉE

## What this is
A 3D cycling game (Three.js + TypeScript + Vite). Pure frontend — **no backend, no database, no external credentials**. The Netlify sync function (`netlify/functions/sync.mts`) is production-only and not used in dev.

## Running it
```bash
docker compose -f docker-compose.base44.yml up -d --build
```
- Vite dev server on host port 3000 (container 5173), live reload via bind mount.
- `node_modules` lives in a named volume so installs persist across rebuilds.
- `npm install` runs at container start, then `vite dev --host 0.0.0.0`.

## Vite host config
`vite.config.ts` sets `server.host: true` and `allowedHosts: true` so the preview proxy's external hostname is accepted. Do not remove these or the preview goes blank.

## Verification
- `curl -s http://localhost:3000/` returns the `index.html` (`ÉCHAPPÉE` title).
- Container healthcheck probes `http://localhost:5173/`.
- The game renders a WebGL canvas; a blank screen usually means a build/TS error — check `docker compose -f docker-compose.base44.yml logs web`.

## Tests (optional, run on host with node)
The `*.mjs` files are headless simulation/smoke tests (`node smoke5.mjs`, etc.). They need `npm install` first and run against the source directly, not the container.
