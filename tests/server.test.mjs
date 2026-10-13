import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAppServer } from '../server.mjs';

const repo = dirname(dirname(fileURLToPath(import.meta.url)));
const server = createAppServer({
  search: async (query) => [{ id: 123, title: query || 'رپ فارسی', artist: 'Test Artist' }],
});
let base;

before(async () => {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  base = 'http://127.0.0.1:' + server.address().port;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
});

test('serves the expected public HTML, CSS and JS', async () => {
  for (const [url, mime] of [
    ['/', 'text/html'], ['/index.html', 'text/html'],
    ['/styles.css', 'text/css'], ['/app.js', 'text/javascript'],
  ]) {
    const response = await fetch(base + url);
    assert.equal(response.status, 200, url);
    assert.match(response.headers.get('content-type'), new RegExp(mime));
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.ok((await response.text()).length > 50, url);
  }
});

test('only explicit asset paths are reachable, even if files exist', async () => {
  const forbidden = [
    '/server.mjs', '/package.json', '/.env', '/.git/config',
    '/scripts/build.mjs', '/public/index.html', '/dist/index.html',
    '/styles.css/../server.mjs', '/%2e%2e/server.mjs',
    '/%2eenv', '/README.md', '/tests/server.test.mjs',
  ];
  for (const path of forbidden) {
    const response = await fetch(base + path);
    assert.equal(response.status, 404, path);
    assert.notEqual((await response.text()).includes('createAppServer'), true);
  }
});

test('handles HEAD without returning the file body', async () => {
  const response = await fetch(base + '/app.js', { method: 'HEAD' });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '');
  assert.ok(Number(response.headers.get('content-length')) > 0);
});

test('rejects methods that mutate state', async () => {
  for (const path of ['/', '/api/search']) {
    const response = await fetch(base + path, { method: 'POST' });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'GET, HEAD');
  }
});

test('preserves the music search API and CORS for static site hosts', async () => {
  const response = await fetch(base + '/api/search?q=' + encodeURIComponent('آهنگ تست'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  const data = await response.json();
  assert.equal(data.tracks[0].title, 'آهنگ تست');
});

test('rejects oversized search terms without an upstream request', async () => {
  const response = await fetch(base + '/api/search?q=' + 'a'.repeat(121));
  assert.equal(response.status, 400);
});

test('returns a non-sensitive error when search provider fails', async () => {
  const failing = createAppServer({
    search: async () => { throw new Error('private provider details'); },
  });
  await new Promise((resolve) => failing.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch('http://127.0.0.1:' + failing.address().port + '/api/search');
    assert.equal(response.status, 503);
    assert.ok(!(await response.text()).includes('private provider details'));
  } finally {
    await new Promise((resolve) => failing.close(resolve));
  }
});

test('rejects symlinked public assets', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'rapfa-public-'));
  const custom = createAppServer({ staticRoot: dir });
  try {
    try {
      await symlink(join(repo, 'server.mjs'), join(dir, 'app.js'));
    } catch (error) {
      if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) {
        t.skip('Creating symbolic links is not permitted on this runner');
        return;
      }
      throw error;
    }
    await new Promise((resolve) => custom.listen(0, '127.0.0.1', resolve));
    try {
      const response = await fetch('http://127.0.0.1:' + custom.address().port + '/app.js');
      assert.equal(response.status, 404);
    } finally {
      await new Promise((resolve) => custom.close(resolve));
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('npm build outputs exactly three approved assets', async () => {
  const run = spawnSync(process.execPath, ['scripts/build.mjs'], {
    cwd: repo, encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr);
  const expected = ['app.js', 'index.html', 'styles.css'];
  assert.deepEqual((await readdir(join(repo, 'dist'))).sort(), expected);
  for (const file of expected) {
    assert.deepEqual(
      await readFile(join(repo, 'dist', file)),
      await readFile(join(repo, 'public', file)),
    );
  }
});

test('both players have matching selectors and hidden states', async () => {
  const html = await readFile(join(repo, 'public/index.html'), 'utf8');
  const css = await readFile(join(repo, 'public/styles.css'), 'utf8');
  const js = await readFile(join(repo, 'public/app.js'), 'utf8');
  assert.match(html, /id="soundcloud-player"[^>]*hidden/);
  assert.match(html, /id="preview-player"[^>]*hidden/);
  assert.match(css, /#soundcloud-player\{/);
  assert.match(css, /#preview-player\{/);
  assert.match(css, /#soundcloud-player\[hidden\]/);
  assert.match(css, /#preview-player\[hidden\]/);
  assert.match(js, /soundcloudPlayer\.hidden=!full/);
  assert.match(js, /previewPlayer\.hidden=full/);
});
