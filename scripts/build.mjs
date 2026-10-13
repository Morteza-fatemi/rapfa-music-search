import { copyFile, lstat, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, 'public');
const destination = join(root, 'dist');
// Copy only reviewed web assets; secrets and application code remain private.
const allowed = ['index.html', 'styles.css', 'app.js'];

for (const filename of allowed) {
  const info = await lstat(join(source, filename));
  if (!info.isFile()) throw new Error('Required public asset is not a regular file: ' + filename);
}
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const filename of allowed) {
  await copyFile(join(source, filename), join(destination, filename));
}
console.log('Built ' + allowed.length + ' public assets into dist/');

const raw = (process.env.RAPFA_API_BASE_URL || '').trim();
if (raw) {
  const configured = new URL(raw);
  if (!['http:', 'https:'].includes(configured.protocol) ||
      configured.username || configured.password ||
      configured.search || configured.hash ||
      configured.pathname !== '/' ||
      (configured.protocol !== 'https:' && !['localhost','127.0.0.1','[::1]'].includes(configured.hostname))) {
    throw new Error('RAPFA_API_BASE_URL must be an HTTPS origin (HTTP allowed only for local loopback)');
  }
  const indexPath = join(destination, 'index.html');
  const sourceHtml = await readFile(indexPath, 'utf8');
  const origin = configured.origin.replaceAll('&','&amp;').replaceAll('"','&quot;');
  const needle = '<meta name="rapfa-api-base" content=""/>';
  if (!sourceHtml.includes(needle)) throw new Error('Missing API origin meta in public/index.html');
  await writeFile(indexPath, sourceHtml.replace(needle,
    '<meta name="rapfa-api-base" content="' + origin + '"/>'));
  console.log('Configured browser API origin for static hosting: ' + configured.origin);
} else {
  console.log('Browser API: same origin (local Node server)');
}
