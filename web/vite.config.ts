import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { request as httpRequest } from 'http'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'proxy-workspace-api',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && /^\/[^/]+\/(api|mcp)(\/|$|\?)/.test(req.url)) {
            const proxyReq = httpRequest(
              `http://localhost:7432${req.url}`,
              { method: req.method, headers: req.headers },
              (proxyRes) => {
                res.writeHead(proxyRes.statusCode!, proxyRes.headers);
                proxyRes.pipe(res);
              },
            );
            proxyReq.on('error', () => {
              res.writeHead(502);
              res.end('Bad Gateway');
            });
            req.pipe(proxyReq);
            return;
          }
          next();
        });
      },
    },
  ],
  build: {
    outDir: 'dist',
  },
})
