import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import fs from 'fs';
import os from 'os';
import { exec, execSync } from 'child_process';
import express from 'express';

// Resolve true Windows Downloads folder, fallback to default homedir
function getDownloadsFolder() {
  try {
    const winPath = execSync('powershell.exe -NoProfile -Command "(New-Object -ComObject Shell.Application).NameSpace(\'shell:Downloads\').Self.Path"', { encoding: 'utf8' }).trim();
    if (winPath && fs.existsSync(winPath)) return winPath;
  } catch (e) {
    console.warn("Could not resolve shell:Downloads via COM, falling back to os.homedir().");
  }
  return path.join(os.homedir(), 'Downloads');
}

// Simple Vite plugin to handle local file system operations using Express
const localFileAPIPlugin = () => ({
  name: 'local-api-plugin',
  configureServer(server: any) {
    const app = express();
    app.use(express.json({ limit: '200mb' }));
    app.use(express.raw({ limit: '200mb', type: 'application/octet-stream' }));
    
    app.get('/api/skills', (req, res) => {
      try {
        const humanizerPath = 'D:\\cc\\Library\\Tools\\humanizer-zh\\SKILL.md';
        const writingStylePath = 'D:\\cc\\Library\\Tools\\WritingStyle\\SKILL.md';
        
        const humanizer = fs.existsSync(humanizerPath) ? fs.readFileSync(humanizerPath, 'utf8') : '';
        const writingStyle = fs.existsSync(writingStylePath) ? fs.readFileSync(writingStylePath, 'utf8') : '';
        
        res.status(200).json({ humanizer, writingStyle });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.post('/api/save-zip', (req, res) => {
      try {
        const body = req.body;
        const downloadsPath = getDownloadsFolder();
        const timestamp = new Date().toISOString().replace(/[:\.]/g, '-');
        const targetPath = path.join(downloadsPath, `连载系列_全部篇目_${timestamp}.zip`);
        fs.writeFileSync(targetPath, body);
        res.status(200).json({ path: targetPath });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.post('/api/save-file', (req, res) => {
      try {
        const { filename, content } = req.body;
        const downloadsPath = getDownloadsFolder();
        const targetPath = path.join(downloadsPath, filename);
        fs.writeFileSync(targetPath, content, 'utf8');
        res.status(200).json({ path: targetPath });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.post('/api/open-folder', (req, res) => {
      try {
        const { targetPath } = req.body;
        exec(`explorer /select,"${targetPath}"`, (err) => {
          if (err) console.error(err);
        });
        res.status(200).json({ success: true });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.post('/api/save-state', (req, res) => {
      try {
        const statePath = path.join(__dirname, '.app_state.json');
        fs.writeFileSync(statePath, JSON.stringify(req.body, null, 2));
        res.status(200).json({ success: true });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.get('/api/load-state', (req, res) => {
      try {
        const statePath = path.join(__dirname, '.app_state.json');
        if (fs.existsSync(statePath)) {
          const data = fs.readFileSync(statePath, 'utf8');
          res.setHeader('Content-Type', 'application/json');
          res.status(200).send(data);
        } else {
          res.status(404).json({ error: 'Not found' });
        }
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    server.middlewares.use(app);
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
    build: {
      chunkSizeWarningLimit: 1500
    }
  };
});
