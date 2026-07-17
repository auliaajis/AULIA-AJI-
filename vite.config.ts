import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {viteSingleFile} from 'vite-plugin-singlefile';
import fs from 'fs';

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(), 
      viteSingleFile(),
      {
        name: 'serve-compiled-html',
        configureServer(server) {
          server.middlewares.use('/api/get-compiled-html', (req, res) => {
            try {
              const filePath = path.resolve(__dirname, 'dist/index.html');
              if (fs.existsSync(filePath)) {
                res.writeHead(200, {
                  'Content-Type': 'text/html; charset=utf-8',
                  'Content-Disposition': 'attachment; filename="Index.html"',
                  'Access-Control-Allow-Origin': '*'
                });
                res.end(fs.readFileSync(filePath));
              } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('File dist/index.html not found. Please build the project first.');
              }
            } catch (err: any) {
              res.writeHead(500, { 'Content-Type': 'text/plain' });
              res.end('Error serving compiled HTML: ' + err.message);
            }
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
