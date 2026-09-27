# AGENTS.md

## Project: ÉCHAPPÉE

A 3D cycling game in the browser — career mode, stage races, effort/fuel
management, rankings and jerseys. **Frontend-only**: Three.js + TypeScript +
Vite. No backend, no database, no external services required for development.

## Running in the Base44 sandbox

```bash
docker compose -f docker-compose.base44.yml up -d --build
```

- The app is a Vite dev server (`npm run dev`) on port 5173, mapped to host
  port 3000.
- `node_modules` is stored in a named volume so it survives container
  restarts without reinstalling.
- `npm install` runs at container startup (inside the command), so no image
  rebuild is needed when `package.json` changes.
- `vite.config.ts` has `server.host: true` and `server.allowedHosts: true` so
  the preview's external hostname is accepted.

## No secrets

The app needs no external credentials. The `netlify/functions/sync.mts` server
function is for production cross-device sync via Netlify Blobs and is not used
in development — the game falls back to local file-based save.

## Verifying it works

- `docker compose -f docker-compose.base44.yml ps` — the `web` service should
  be `healthy`.
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` — should
  return `200`.
- The preview shows the game's main menu (canvas + UI overlay).

## Notes

- The repo contains many `*.mjs` test/smoke scripts (Playwright-based) at the
  root — these are dev tooling, not part of the app build.
- `copier-fonctions.mjs` copies Netlify function config into `dist/` during
  `npm run build`; irrelevant for the dev server.
