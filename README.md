# Rapfa Music Search

Persian-language music search interface with official Apple Music/iTunes previews and selected official SoundCloud embeds. The Node.js web server provides the search API and serves a small allowlisted set of static assets.

## Requirements

- Node.js 18.18+ (Node.js 20 recommended)
- No external npm packages required

## Run locally

```bash
npm start
```

Open http://localhost:3000. Change the port with `PORT=4000 npm start` (or set `PORT` in your deployment environment). The server serves `public/` without requiring a build.

## Build and verify

```bash
npm run check
npm run build
npm test
npm start
```

The build copies **only** `public/index.html`, `public/styles.css` and `public/app.js` into `dist/`, and optionally injects an explicitly configured API origin into the generated `dist/index.html`. If `dist/` exists, the server serves these generated assets; otherwise it serves the same files from `public/`.

## Project layout

- `server.mjs`: HTTP server, allowlisted static routes and `GET /api/search`
- `public/`: source HTML, CSS and browser JavaScript
- `scripts/build.mjs`: reproducible static build without third-party dependencies
- `tests/server.test.mjs`: API, static isolation, player and build regression tests
- `.github/workflows/quality.yml`: CI checks on pushes and pull requests

## Security

Only `/`, `/index.html`, `/styles.css` and `/app.js` are served as static resources. The URL path is matched against this allowlist **before** any filesystem access. No repository source, `.env`, `.git/`, build scripts, or other paths are publicly exposed by the Node server. Symlinks are also rejected.

Do not commit API keys or configuration secrets. Review the hosting platform's own public-directory and reverse-proxy settings independently of the Node application.

The API accepts a maximum 120-character search string, sets an upstream request timeout, returns generic provider failure messages, and retains `Access-Control-Allow-Origin: *` for public read-only search requests. This API is intentionally public and has no credentials. Deploy behind hosting-level rate limiting if traffic grows.

## API origin and offline/local development

The HTML contains an empty `<meta name="rapfa-api-base" content="">` by default. An empty value means **same-origin requests** to `/api/search`; no Render or other external host is hardcoded in browser JavaScript.

For local development, run `npm start` (optionally `npm run build` first). For a statically hosted frontend whose API is deployed elsewhere, explicitly set the build-time environment variable and deploy the generated `dist/` directory:

```bash
RAPFA_API_BASE_URL=https://your-public-api.example npm run build
```

On Windows PowerShell:

```powershell
$env:RAPFA_API_BASE_URL = "https://your-public-api.example"
npm run build
Remove-Item Env:RAPFA_API_BASE_URL
```

Build validation allows only HTTPS **origins** (without embedded credentials, paths, query strings or fragments). Plain HTTP origins are allowed only for loopback development. To use local API again, clear the build variable and rerun `npm run build`. The source `public/index.html` is never altered by a configured build.

When deploying a static frontend on another domain, configure your API host's CORS/network policy accordingly. The Node server's search endpoint is public and read-only.

## Versioned source releases

Use [RELEASE_PROCESS.md](RELEASE_PROCESS.md) for tagging SemVer commits and the CI-gated preview workflow. The original `v0.1.0` release is source-only; future tags run fresh checks and are published as prereleases if all gates pass. No Windows installer or production guarantee is implied.

## Deployment

For Render Web Service or equivalent:

- Build command: `npm run build`
- Start command: `npm start`
- Runtime: Node.js 20 or newer

If a host uses `npm start` directly without the build step, the source `public/` assets are served. Without an explicit override the browser calls **the same origin** as the page, so `npm start` and the local `GET /api/search` work together. If you build with an external API origin, rebuild with the variable unset before switching back to local mode.

## Known limitations

- Catalog searches require access to Apple Music/iTunes Search APIs.
- Official external audio previews and SoundCloud embeds may have regional availability limits.
- Playwright runs browser E2E tests on Chromium, including an actual browser → local Node API request without request interception, plus separately mocked UI/provider cases.
- Hosted CI cannot guarantee that Apple Music, iTunes or SoundCloud currently respond in a given region.
