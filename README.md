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

The build copies **only** `public/index.html`, `public/styles.css` and `public/app.js` into `dist/`. If `dist/` exists, the server serves these generated assets; otherwise it serves the same files from `public/`.

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

## Deployment

For Render Web Service or equivalent:

- Build command: `npm run build`
- Start command: `npm start`
- Runtime: Node.js 20 or newer

If a host uses `npm start` directly without the build step, the source `public/` assets are served. The site preserves its existing public search behavior.

## Known limitations

- Catalog searches require access to Apple Music/iTunes Search APIs.
- Official external audio previews and SoundCloud embeds may have regional availability limits.
- No end-to-end browser/visual test is included; Node integration tests cover HTTP behavior and HTML/CSS/JS player wiring.
