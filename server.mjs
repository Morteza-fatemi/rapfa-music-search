import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

// Render deploys this small application from the repository root.
const root = process.cwd();
const types = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const send = (res, status, body, type = 'application/json; charset=utf-8') => { res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }); res.end(typeof body === 'string' ? body : JSON.stringify(body)); };
const artistIds = new Map([['sajad shahi', '1640091683'], ['sajjad shahi', '1640091683'], ['سجاد شاهی', '1640091683']]);
const sajadSoundCloud = ['mord','rakab','tragedy','harifam-ni','fall','tasliat','pop','miras','upset','boro'].map((slug) => ({ id: `soundcloud-${slug}`, title: slug.toUpperCase().replaceAll('-', ' '), artist: 'Sajad Shahi', kind: 'پخش کامل رسمی SoundCloud', post: `https://soundcloud.com/sajadshahi/${slug}`, full: `https://soundcloud.com/sajadshahi/${slug}` }));

async function searchMusic(query) {
  const term = (query || 'رپ فارسی').trim();
  const artistId = artistIds.get(term.toLowerCase());
  if (artistId) return sajadSoundCloud;
  const request = new URL(artistId ? 'https://itunes.apple.com/lookup' : 'https://itunes.apple.com/search');
  request.search = new URLSearchParams(artistId ? { id: artistId, entity: 'song' } : { term, media: 'music', entity: 'song', limit: '25' });
  const response = await fetch(request);
  if (!response.ok) throw new Error(`Music search returned ${response.status}`);
  const data = await response.json();
  return (data.results || []).map((item) => ({ id: item.trackId, title: item.trackName, artist: item.artistName, kind: 'پیش‌نمایش رسمی ۳۰ثانیه‌ای', thumbnail: item.artworkUrl100, post: item.trackViewUrl, preview: item.previewUrl })).filter((item) => item.id && item.preview);
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/search') {
    try { send(res, 200, { tracks: await searchMusic(url.searchParams.get('q') || '') }); }
    catch { send(res, 503, { error: 'جست‌وجوی موسیقی موقتاً پاسخ نداد؛ کمی بعد دوباره امتحان کن.' }); }
    return;
  }
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = normalize(join(root, requested));
  if (!file.startsWith(root)) return send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
  try { const info = await stat(file); if (!info.isFile()) throw new Error(); const body = await readFile(file); res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }); res.end(body); }
  catch { send(res, 404, 'Not found', 'text/plain; charset=utf-8'); }
}).listen(process.env.PORT || 3000, () => console.log('Music search server started'));
