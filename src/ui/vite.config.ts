import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'

/**
 * Vite's SPA fallback rewrites requests for unknown file extensions to
 * index.html. This breaks fetch() for binary files like .docx and .xlsx
 * served from the public/ directory. This plugin intercepts those requests
 * before the fallback and serves the actual file.
 */
function serveDocumentFiles(): Plugin {
  const binaryExts = new Set(['.docx', '.xlsx', '.pptx', '.doc', '.xls']);
  return {
    name: 'serve-document-files',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        const ext = path.extname(url).toLowerCase();
        if (!binaryExts.has(ext)) return next();

        const filePath = path.join(server.config.publicDir, url);
        if (!fs.existsSync(filePath)) return next();

        const mimeTypes: Record<string, string> = {
          '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          '.doc': 'application/msword',
          '.xls': 'application/vnd.ms-excel',
        };
        res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
        fs.createReadStream(filePath).pipe(res);
      });
    },
  };
}

export default defineConfig({
  plugins: [serveDocumentFiles(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
})
