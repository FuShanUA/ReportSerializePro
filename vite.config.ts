import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import fs from 'fs';
import os from 'os';
import { exec } from 'child_process';

// Simple Vite plugin to handle local file system operations
const localFileAPIPlugin = () => ({
  name: 'local-api-plugin',
  configureServer(server: any) {
    server.middlewares.use('/api/save-zip', (req: any, res: any) => {
      if (req.method === 'POST') {
        let body = Buffer.alloc(0);
        req.on('data', (chunk: Buffer) => {
          body = Buffer.concat([body, chunk]);
        });
        req.on('end', () => {
          try {
            const downloadsPath = path.join(os.homedir(), 'Downloads');
            const timestamp = new Date().toISOString().replace(/[:\.]/g, '-');
            const targetPath = path.join(downloadsPath, `连载系列_全部篇目_${timestamp}.zip`);
            fs.writeFileSync(targetPath, body);
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({ path: targetPath }));
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      }
    });

    server.middlewares.use('/api/open-folder', (req: any, res: any) => {
      if (req.method === 'POST') {
        let bodyStr = '';
        req.on('data', (chunk: Buffer) => { bodyStr += chunk.toString(); });
        req.on('end', () => {
          try {
            const { targetPath } = JSON.parse(bodyStr);
            // This works on Windows Server/Desktop
            exec(`explorer /select,"${targetPath}"`, (err) => {
              if (err) console.error(err);
            });
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true }));
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      }
    });

    server.middlewares.use('/api/save-state', (req: any, res: any) => {
      if (req.method === 'POST') {
        let body = Buffer.alloc(0);
        req.on('data', (chunk: Buffer) => { body = Buffer.concat([body, chunk]); });
        req.on('end', () => {
          try {
            const statePath = path.join(__dirname, '.app_state.json');
            fs.writeFileSync(statePath, body);
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true }));
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      }
    });

    server.middlewares.use('/api/load-state', (req: any, res: any) => {
      if (req.method === 'GET') {
        try {
          const statePath = path.join(__dirname, '.app_state.json');
          if (fs.existsSync(statePath)) {
            const data = fs.readFileSync(statePath, 'utf8');
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(data);
          } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Not found' }));
          }
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      }
    });
  }
});

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), localFileAPIPlugin()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: {
        ignored: ['**/.app_state.json']
      }
    },
  };
});
