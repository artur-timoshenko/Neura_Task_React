import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createFrontend, readHostingConfig } from '../hosting/app.mjs';
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve('http://127.0.0.1:' + server.address().port)));

test('frontend preserves API paths, upload bodies, status codes and SPA routes', async t => {
  const dist = await mkdtemp(path.join(tmpdir(), 'hub-ui-'));
  await mkdir(path.join(dist, 'assets'));
  await writeFile(path.join(dist, 'index.html'), '<html><title>Neura Task Manager</title><meta property="og:image" content="__PUBLIC_ORIGIN__/social-preview.png"></html>');
  await writeFile(path.join(dist, 'assets', 'app.js'), '/* asset */');
  const upstream = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = req.url.startsWith('/api/private') ? 401 : 200;
    res.end(JSON.stringify({ path: req.url, body, contentType: req.headers['content-type'], origin: req.headers.origin, cookie: req.headers.cookie, auth: req.headers.authorization }));
  });
  const config = { backendUrl: await listen(upstream), production: false };
  const { app, upgrade } = createFrontend(config, dist);
  const server = createServer(app); server.on('upgrade', upgrade);
  const base = await listen(server);
  t.after(async () => { server.closeAllConnections(); server.close(); upstream.closeAllConnections(); upstream.close(); await rm(dist, { recursive: true }); });
  assert.equal((await fetch(base + '/healthz')).status, 200);
  const taskPage = await (await fetch(base + '/task/123')).text();
  assert.match(taskPage, /Neura Task Manager/);
  assert.match(taskPage, new RegExp(base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\/social-preview\\.png'));
  assert.doesNotMatch(taskPage, /__PUBLIC_ORIGIN__/);
  for (const url of ['/', '/index.html']) {
    const html = await (await fetch(base + url)).text();
    assert.doesNotMatch(html, /__PUBLIC_ORIGIN__/);
    assert.ok(html.includes(base + '/social-preview.png'));
  }
  const asset = await fetch(base + '/assets/app.js');
  assert.match(asset.headers.get('cache-control'), /immutable/);
  assert.equal((await fetch(base + '/assets/missing.js')).status, 404);
  assert.equal((await fetch(base + '/api/private')).status, 401);
  const body = '--boundary\r\nraw multipart image bytes\r\n--boundary--';
  const response = await fetch(base + '/api/supabase/storage/v1/object/task-files/file.png?upsert=false', {
    method: 'POST', body, headers: { 'content-type': 'multipart/form-data; boundary=boundary', authorization: 'Bearer user-token', origin: base, cookie: 'unrelated=value' },
  });
  const received = await response.json();
  assert.equal(received.path, '/api/supabase/storage/v1/object/task-files/file.png?upsert=false');
  assert.equal(received.body, body);
  assert.equal(received.origin, base);
  assert.equal(received.auth, 'Bearer user-token');
  assert.equal(received.cookie, undefined);
});

test('production requires one fixed backend origin without embedded credentials', () => {
  assert.throws(() => readHostingConfig({ NODE_ENV: 'production' }), /BACKEND_URL/);
  for (const value of ['file:///etc/passwd', 'https://user:password@example.test', 'https://example.test/api']) {
    assert.throws(() => readHostingConfig({ BACKEND_URL: value }), /BACKEND_URL/);
  }
  assert.equal(readHostingConfig({ BACKEND_URL: 'http://backend.railway.internal:3001' }).backendUrl, 'http://backend.railway.internal:3001');
});
