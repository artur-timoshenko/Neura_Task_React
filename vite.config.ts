import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    server: {
      host: '::', port: 8080, strictPort: true,
      proxy: { '/api': { target: env.BACKEND_URL || 'http://127.0.0.1:3001', changeOrigin: true, ws: true } },
    },
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
      dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    },
    esbuild: mode === 'production'
      ? { drop: ['debugger'], pure: ['console.log', 'console.info', 'console.debug'] }
      : undefined,
  };
});
