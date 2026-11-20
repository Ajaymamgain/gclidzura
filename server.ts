import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { conversionService, DEFAULT_SG_HOME_SERVICES_CSV } from './server/conversionService.ts';
import { runZuraAssistantChat } from './server/geminiAssistant.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '2mb' }));

  // --- Zura Conversion Service API ---

  app.get('/api/workspace', (_req, res) => {
    res.json({
      workspace: conversionService.getWorkspaceState(),
      sampleCsv: DEFAULT_SG_HOME_SERVICES_CSV,
    });
  });

  app.post('/api/workspace/connect', (req, res) => {
    try {
      const workspace = conversionService.updateConnection(req.body ?? {});
      res.json({ workspace });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/workspace/destinations', (req, res) => {
    try {
      const { id, patch } = req.body ?? {};
      if (!id) {
        res.status(400).json({ error: 'Destination id is required.' });
        return;
      }
      const workspace = conversionService.updateDestination(id, patch ?? {});
      res.json({ workspace });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/workspace/source/csv', (req, res) => {
    try {
      const { csvText, filename } = req.body ?? {};
      if (typeof csvText !== 'string' || csvText.trim().length === 0) {
        res.status(400).json({ error: 'csvText is required.' });
        return;
      }
      const workspace = conversionService.uploadCsv(csvText, filename || 'custom_outcomes.csv');
      res.json({ workspace });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/workspace/source/ingest-event', (req, res) => {
    try {
      const apiKey = req.header('x-zura-ingestion-key');
      const workspace = conversionService.ingestApiEvent(apiKey, req.body ?? {});
      res.status(201).json({ workspace });
    } catch (err) {
      const message = (err as Error).message;
      res.status(message.startsWith('Unauthorized') ? 401 : 400).json({ error: message });
    }
  });

  app.post('/api/workspace/mapping', (req, res) => {
    try {
      const workspace = conversionService.updateMapping(req.body);
      res.json({ workspace });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/workspace/fix-row', (req, res) => {
    try {
      const { rowIndex, fixes } = req.body ?? {};
      const workspace = conversionService.fixRow(Number(rowIndex), fixes ?? {});
      res.json({ workspace });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/workspace/validate', (_req, res) => {
    try {
      const result = conversionService.runDryValidation();
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/workspace/approve', (req, res) => {
    try {
      const { approvedBy } = req.body ?? {};
      const workspace = conversionService.approveFirstLiveRun(approvedBy);
      res.json({ workspace });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/workspace/run', (req, res) => {
    try {
      const { trigger } = req.body ?? {};
      const workspace = conversionService.executeLiveRun(trigger || 'manual_first_live');
      res.json({ workspace });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/workspace/schedule', (req, res) => {
    try {
      const workspace = conversionService.updateSchedule(req.body ?? {});
      res.json({ workspace });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/workspace/leads/advance', (req, res) => {
    try {
      const { leadId, nextStage, valueSgd, repName } = req.body ?? {};
      const workspace = conversionService.advanceWhatsAppLead(
        String(leadId ?? ''),
        nextStage,
        valueSgd !== undefined ? Number(valueSgd) : undefined,
        repName ? String(repName) : 'Rachel Tan (Sales Rep)'
      );
      res.json({ workspace });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/workspace/leads/create', (req, res) => {
    try {
      const workspace = conversionService.createWhatsAppLead(req.body ?? {});
      res.status(201).json({ workspace });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/workspace/audiences/sync', (req, res) => {
    try {
      const { addedCount, actor } = req.body ?? {};
      const workspace = conversionService.syncCustomerMatchAudience(
        Number(addedCount) || 45,
        actor ? String(actor) : 'ops@coolcare.sg'
      );
      res.json({ workspace });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // --- Scoped Gemini Assistant Endpoint ---
  app.post('/api/assistant/chat', async (req, res) => {
    try {
      const { message, history } = req.body ?? {};
      if (typeof message !== 'string' || message.trim().length === 0) {
        res.status(400).json({ error: 'Message is required.' });
        return;
      }
      const result = await runZuraAssistantChat(message.trim(), Array.isArray(history) ? history : []);
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Assistant request failed.';
      res.status(502).json({ error: message });
    }
  });

  // Guarantee /api/* routes never fall through to Vite/SPA HTML (prevents "Unexpected token '<'")
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith('/api')) {
      const message = err instanceof Error ? err.message : 'Unexpected server error.';
      res.status(500).json({ error: message });
      return;
    }
    next(err);
  });

  // --- Frontend Serving (Vite Dev Middleware or Production Dist) ---
  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(__dirname, 'dist');

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Zura Conversions server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
