import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

// Render deploys this small application from the repository root.
const root = process.cwd();
const types = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const send = (res, status, body, type = 'application/json; charset=utf-8') => { res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(typeof body === 'string' ? body : JSON.stringify(body)); };

async function searchYouTube(query) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('YOUTUBE_API_KEY is not configured');
  const request = new URL('https://www.googleapis.com/youtube/v3/search');
  request.search = new URLSearchParams({ key, part: 'snippet', type: 'video', videoEmbeddable: 'true', maxResults: '24', order: 'date', q: `${query || 'رپ فارسی جدید'} رپ فارسی` });
  const response = await fetch(request);
  if (!response.ok) throw new Error(`YouTube returned ${response.status}`);
  const data = await response.json();
  return (data.items || []).map((item) => ({ id: item.id.videoId, title: item.snippet.title, artist: item.snippet.channelTitle, kind: 'ویدئوی قابل پخش یوتیوب', thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '', post: `https://www.youtube.com/watch?v=${item.id.videoId}`, embed: `https://www.youtube-nocookie.com/embed/${item.id.videoId}?autoplay=1&rel=0` })).filter((item) => item.id);
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/search') {
    try { send(res, 200, { tracks: await searchYouTube(url.searchParams.get('q') || '') }); }
    catch { send(res, 503, { error: process.env.YOUTUBE_API_KEY ? 'جست‌وجوی یوتیوب موقتاً پاسخ نداد؛ کمی بعد دوباره امتحان کن.' : 'کلید YouTube API هنوز در تنظیمات سرور وارد نشده است.' }); }
    return;
  }
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = normalize(join(root, requested));
  if (!file.startsWith(root)) return send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
  try { const info = await stat(file); if (!info.isFile()) throw new Error(); const body = await readFile(file); res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }); res.end(body); }
  catch { send(res, 404, 'Not found', 'text/plain; charset=utf-8'); }
}).listen(process.env.PORT || 3000, () => console.log('Music search server started'));
