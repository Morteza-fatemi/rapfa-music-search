# Rapfa v0.1.0 — Node.js source preview (2026-10-13)

**Scope:** public Node.js source release for music catalog search, not a guarantee of third-party provider uptime or licensed music redistribution.

## Included
- Allowlisted static assets isolated in public/ and built into dist/.
- Repeatable Node.js build and API security regression tests.
- Correct SoundCloud and Apple Music/iTunes preview player selection.
- Real Chromium end-to-end UI checks with **synthetic** intercepted search results.
- RTL/mobile layout tests, search error rendering and opening/closing preview modal.
- Startup smoke test and CI.

## Run
Requires Node.js 20+. `npm run build && npm test && npm start`.
No music files are stored or distributed; search and previews rely on authorized third-party service availability.

## Limitations
- Browser tests mock API data and do not validate Apple Music or SoundCloud live availability.
- Traffic controls and reverse-proxy configuration must be verified for each deployment.
- The current app uses a configured external API origin for static-host compatibility; consider environment-based API configuration in the next milestone.

No compiled binary attached; use the source archive.
