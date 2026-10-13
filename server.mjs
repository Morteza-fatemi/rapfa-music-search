import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { lstat, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = dirname(fileURLToPath(import.meta.url));
// Render may run "npm start" without a build. In that case, serve public/.
// After "npm run build", use the generated, allowlisted dist/ assets.
const defaultStaticRoot = existsSync(join(repositoryRoot, 'dist'))
  ? join(repositoryRoot, 'dist')
  : join(repositoryRoot, 'public');

// Request-controlled paths are NEVER passed to the filesystem. A whitelist
// prevents serving source files, .env, .git/, package.json, or future secrets.
const publicAssets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
]);

function reply(res, method, status, body, contentType, extraHeaders = {}) {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(
    typeof body === 'string' ? body : JSON.stringify(body)
  );
  res.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': String(payload.length),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    ...extraHeaders,
  });
  res.end(method === 'HEAD' ? undefined : payload);
}

const artistIds = new Map([
  ['sajad shahi', '1640091683'],
  ['sajjad shahi', '1640091683'],
  ['سجاد شاهی', '1640091683'],
]);
const sajadSoundCloud = [
  'mord', 'rakab', 'tragedy', 'harifam-ni', 'fall',
  'tasliat', 'pop', 'miras', 'upset', 'boro',
].map((slug) => ({
  id: 'soundcloud-' + slug,
  title: slug.toUpperCase().replaceAll('-', ' '),
  artist: 'Sajad Shahi',
  kind: 'پخش کامل رسمی SoundCloud',
  post: 'https://soundcloud.com/sajadshahi/' + slug,
  full: 'https://soundcloud.com/sajadshahi/' + slug,
}));

export async function searchMusic(query) {
  const term = (query || 'رپ فارسی').trim() || 'رپ فارسی';
  if (artistIds.has(term.toLowerCase())) return sajadSoundCloud;

  const request = new URL('https://itunes.apple.com/search');
  request.search = new URLSearchParams({
    term, media: 'music', entity: 'song', limit: '25',
  });
  const response = await fetch(request, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Music search returned ' + response.status);
  const data = await response.json();
  return (data.results || []).map((item) => ({
    id: item.trackId,
    title: item.trackName,
    artist: item.artistName,
    kind: 'پیش‌نمایش رسمی ۳۰ثانیه‌ای',
    thumbnail: item.artworkUrl100,
    post: item.trackViewUrl,
    preview: item.previewUrl,
  })).filter((item) => item.id && item.preview);
}

export function createAppServer({ staticRoot = defaultStaticRoot, search = searchMusic } = {}) {
  const root = resolve(staticRoot);
  return createServer(async (req, res) => {
    const method = req.method || 'GET';
    if (method !== 'GET' && method !== 'HEAD') {
      return reply(res, method, 405, { error: 'Method not allowed' },
        'application/json; charset=utf-8', { Allow: 'GET, HEAD' });
    }

    let url;
    try {
      // Never derive the request origin from the untrusted Host header.
      url = new URL(req.url, 'http://localhost');
    } catch {
      return reply(res, method, 400, { error: 'Bad request' },
        'application/json; charset=utf-8');
    }

    if (url.pathname === '/api/search') {
      const query = url.searchParams.get('q') || '';
      if (query.length > 120) {
        return reply(res, method, 400, { error: 'Search query too long' },
          'application/json; charset=utf-8', { 'Access-Control-Allow-Origin': '*' });
      }
      try {
        const tracks = await search(query);
        return reply(res, method, 200, { tracks },
          'application/json; charset=utf-8', { 'Access-Control-Allow-Origin': '*' });
      } catch {
        return reply(res, method, 503,
          { error: 'جست‌وجوی موسیقی موقتاً پاسخ نداد؛ کمی بعد دوباره امتحان کن.' },
          'application/json; charset=utf-8', { 'Access-Control-Allow-Origin': '*' });
      }
    }

    const asset = publicAssets.get(url.pathname);
    if (!asset) {
      return reply(res, method, 404, 'Not found', 'text/plain; charset=utf-8');
    }

    const [filename, contentType] = asset;
    try {
      const path = join(root, filename);
      const info = await lstat(path);
      // Reject symlinks, directories and devices even for allowlisted names.
      if (!info.isFile()) throw new Error('Not a regular file');
      const body = await readFile(path);
      return reply(res, method, 200, body, contentType);
    } catch {
      return reply(res, method, 404, 'Not found', 'text/plain; charset=utf-8');
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createAppServer().listen(process.env.PORT || 3000, () => {
    console.log('Rapfa music search server started');
  });
}
