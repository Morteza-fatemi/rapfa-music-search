import { copyFile, lstat, mkdir, rm } from 'node:fs/promises';
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
