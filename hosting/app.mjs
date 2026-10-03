import express from 'express';
import helmet from 'helmet';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'node:path';
import { readFileSync } from 'node:fs';

export function readHostingConfig(env = process.env) {
  const raw = env.BACKEND_URL || (env.NODE_ENV !== 'production' ? 'http://127.0.0.1:3001' : '');
  if (!raw) throw new Error('BACKEND_URL is required');
  const backend = new URL(raw);
  if (!['http:', 'https:'].includes(backend.protocol) || backend.username || backend.password ||
      backend.pathname !== '/' || backend.search || backend.hash) {
    throw new Error('BACKEND_URL must be an HTTP(S) origin without a path or credentials');
  }
  const port = Number(env.PORT || 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
  return { backendUrl: backend.origin, port, production: env.NODE_ENV === 'production' };
}

// Hosting only: static assets and a fixed reverse proxy. No business logic or keys.
export function createFrontend(config, dist = path.resolve('dist')) {
  const app = express();
  const indexTemplate = readFileSync(path.join(dist, 'index.html'), 'utf8');
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({
    contentSecurityPolicy: { directives: {
        defaultSrc: ["'self'"], scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'], mediaSrc: ["'self'", 'blob:', 'https:'],
        connectSrc: ["'self'", 'https:', 'wss:'], frameSrc: ["'self'", 'https:'],
        objectSrc: ["'none'"], frameAncestors: ["'none'"],
        upgradeInsecureRequests: config.production ? [] : null,
      } },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.get('/healthz', (_req, res) => res.json({ ok: true, service: 'frontend' }));
  const proxy = createProxyMiddleware({
    target: config.backendUrl,
    changeOrigin: true,
    pathRewrite: (_path, req) => req.originalUrl,
    proxyTimeout: 120_000,
    on: {
      proxyReq: (upstream, req) => {
        // The backend trusts this hop; never let a browser supply its client IP.
        upstream.setHeader('x-forwarded-for', req.ip || req.socket.remoteAddress || '');
        upstream.removeHeader('cookie');
        upstream.removeHeader('x-forwarded-host');
      },
      error: (_error, _req, res) => {
        if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end('{"error":"Backend unavailable"}');
      },
    },
  });
  // Do not parse JSON/form-data here: uploads and response streams pass unchanged.
  app.use('/api', proxy);
  app.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }));
  const sendIndex = (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    const requestOrigin = new URL(req.protocol + '://' + req.get('host')).origin;
    const safeOrigin = requestOrigin.replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]);
    res.type('html').send(indexTemplate.replaceAll('__PUBLIC_ORIGIN__', safeOrigin));
  };
  app.get('/index.html', sendIndex);
  app.use(express.static(dist, { maxAge: 0, dotfiles: 'deny', index: false }));
  app.get('/{*path}', sendIndex);
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: 'Resource unavailable' }));
  const socketProxy = createProxyMiddleware({
    target: config.backendUrl, changeOrigin: true,
    on: { error: (_error, _req, socket) => socket.destroy?.() },
  });
  const upgrade = (req, socket, head) => {
    // Auth and origin checks are performed by the independent backend.
    if (req.url?.split('?')[0] !== '/api/supabase/realtime/v1/websocket') { socket.destroy(); return; }
    delete req.headers.cookie;
    delete req.headers['x-forwarded-for'];
    socketProxy.upgrade(req, socket, head);
  };
  return { app, upgrade };
}
