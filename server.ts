import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { requireAuth, optionalAuth, type AuthRequest } from './src/middleware/auth.ts';
import { getOrCreateUser } from './src/db/users.ts';
import { isSqlAvailable } from './src/db/index.ts';
import {
  bulkUpdateSampleValidation,
  createDatasetRecord,
  createSampleRecords,
  fetchCorpusSnapshot,
  saveExperimentRecord,
  updateSampleValidation,
} from './src/db/repository.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '4mb' }));

// Allow static-hosted frontends (Firebase Hosting / GitHub Pages) to connect when configured
app.use('/api', (req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

function readFirebaseConfigStatus(): boolean {
  try {
    const rawCfg = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'firebase-applet-config.json'), 'utf8')
    ) as { projectId?: string; firestoreDatabaseId?: string };
    return Boolean(rawCfg.projectId && rawCfg.firestoreDatabaseId);
  } catch {
    return false;
  }
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Health endpoint
app.get('/api/health', async (_req, res) => {
  res.json({
    ok: true,
    service: 'TEXTPRINT',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    sqlConfigured: await isSqlAvailable(),
    firebaseConfigured: readFirebaseConfigStatus(),
    timestamp: new Date().toISOString(),
  });
});

// System & Deployment Status endpoint (non-secret runtime telemetry)
app.get('/api/system/status', async (_req, res) => {
  let firebaseMeta = {
    projectId: '',
    firestoreDatabaseId: '',
    authDomain: '',
  };
  try {
    const rawCfg = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'firebase-applet-config.json'), 'utf8')
    ) as { projectId?: string; firestoreDatabaseId?: string; authDomain?: string };
    firebaseMeta = {
      projectId: rawCfg.projectId ?? '',
      firestoreDatabaseId: rawCfg.firestoreDatabaseId ?? '',
      authDomain: rawCfg.authDomain ?? '',
    };
  } catch {
    // Fallback if config unavailable
  }

  const distBuilt = fs.existsSync(path.join(__dirname, 'dist', 'index.html'));
  const workflows = [
    '.github/workflows/ci-validate.yml',
    '.github/workflows/deploy-pages.yml',
    '.github/workflows/deploy-firebase-dev.yml',
  ].map((wf) => ({
    path: wf,
    exists: fs.existsSync(path.join(__dirname, wf)),
  }));

  res.json({
    ok: true,
    service: 'TEXTPRINT',
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    uptimeSeconds: Math.floor(process.uptime()),
    memoryMb: Math.round(process.memoryUsage().rss / 1048576),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    sql: {
      available: await isSqlAvailable(),
      socketPathConfigured: Boolean(process.env.SQL_HOST),
    },
    firebase: firebaseMeta,
    deployment: {
      mode: process.env.NODE_ENV === 'production' ? 'cloud_run_production' : 'dev_server',
      distBuilt,
      firebaseJsonPresent: fs.existsSync(path.join(__dirname, 'firebase.json')),
      firestoreRulesPresent: fs.existsSync(path.join(__dirname, 'firestore.rules')),
      workflows,
    },
    timestamp: new Date().toISOString(),
  });
});

// Corpus snapshot (datasets, samples, sources, jobs, patterns, experiments, audit logs)
app.get('/api/corpus', optionalAuth, async (_req: AuthRequest, res) => {
  try {
    const snapshot = await fetchCorpusSnapshot();
    res.json(snapshot);
  } catch (error) {
    console.error('Failed to load corpus snapshot:', error);
    res.status(500).json({ error: 'Failed to load corpus snapshot.' });
  }
});

// Sync authenticated researcher into PostgreSQL users table when reachable
app.post('/api/auth/sync', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user?.uid || !req.user?.email) {
      return res.status(400).json({ error: 'Missing authenticated user identity.' });
    }
    const user = await getOrCreateUser(
      req.user.uid,
      req.user.email,
      (req.user.name as string | undefined) ?? null
    );
    return res.json({ syncedToSql: Boolean(user), user, uid: req.user.uid });
  } catch (error) {
    console.error('Auth sync error:', error);
    res.status(500).json({ error: 'Failed to synchronize user.' });
  }
});

// Protected DB mutation routes
app.post('/api/db/datasets', requireAuth, async (req: AuthRequest, res) => {
  try {
    const dataset = req.body?.dataset;
    if (!dataset || typeof dataset.dataset_key !== 'string' || typeof dataset.name !== 'string') {
      return res.status(400).json({ error: 'Invalid dataset payload.' });
    }
    const result = await createDatasetRecord(dataset, req.user!.uid);
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error('Dataset create error:', error);
    res.status(500).json({ error: 'Failed to persist dataset.' });
  }
});

app.post('/api/db/samples', requireAuth, async (req: AuthRequest, res) => {
  try {
    const incomingSamples = req.body?.samples;
    if (!Array.isArray(incomingSamples) || incomingSamples.length === 0) {
      return res.status(400).json({ error: 'samples array is required.' });
    }
    if (incomingSamples.length > 200) {
      return res.status(400).json({ error: 'Batch size limited to 200 samples per request.' });
    }
    const result = await createSampleRecords(incomingSamples, req.user!.uid);
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error('Sample batch create error:', error);
    res.status(500).json({ error: 'Failed to persist samples.' });
  }
});

app.patch('/api/db/samples/bulk-validate', requireAuth, async (req: AuthRequest, res) => {
  try {
    const rawIds = req.body?.sampleIds;
    const status = req.body?.status;
    const layer = req.body?.layer;
    const note = String(req.body?.note || 'Bulk validated by researcher').slice(0, 500);

    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return res.status(400).json({ error: 'sampleIds array is required.' });
    }
    if (rawIds.length > 500) {
      return res.status(400).json({ error: 'Bulk validation batch limited to 500 samples.' });
    }
    const sampleIds = rawIds
      .filter((id): id is string => typeof id === 'string')
      .map((id) => id.trim())
      .filter(Boolean);

    if (sampleIds.length === 0) {
      return res.status(400).json({ error: 'No valid sampleIds provided.' });
    }
    if (!['pending', 'verified', 'rejected', 'quarantined'].includes(status)) {
      return res.status(400).json({ error: 'Invalid validation status.' });
    }
    if (!['raw', 'processed', 'approved'].includes(layer)) {
      return res.status(400).json({ error: 'Invalid storage layer.' });
    }

    const result = await bulkUpdateSampleValidation(
      sampleIds,
      status,
      layer,
      note,
      req.user!.uid
    );
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error('Bulk sample validation error:', error);
    res.status(500).json({ error: 'Failed to bulk update sample validation.' });
  }
});

app.patch('/api/db/samples/:sampleId/validate', requireAuth, async (req: AuthRequest, res) => {
  try {
    const sampleId = String(req.params.sampleId || '').trim();
    const status = req.body?.status;
    const layer = req.body?.layer;
    const note = String(req.body?.note || 'Validated by researcher').slice(0, 500);
    if (!sampleId || !['pending', 'verified', 'rejected', 'quarantined'].includes(status)) {
      return res.status(400).json({ error: 'Invalid validation status.' });
    }
    if (!['raw', 'processed', 'approved'].includes(layer)) {
      return res.status(400).json({ error: 'Invalid storage layer.' });
    }
    const updated = await updateSampleValidation(sampleId, status, layer, note, req.user!.uid);
    res.json({ ok: updated });
  } catch (error) {
    console.error('Sample validation error:', error);
    res.status(500).json({ error: 'Failed to update sample validation.' });
  }
});

app.post('/api/db/experiments', requireAuth, async (req: AuthRequest, res) => {
  try {
    const exp = req.body?.experiment;
    if (!exp || typeof exp.experiment_key !== 'string' || typeof exp.name !== 'string') {
      return res.status(400).json({ error: 'Invalid experiment payload.' });
    }
    const result = await saveExperimentRecord(exp, req.user!.uid);
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error('Experiment save error:', error);
    res.status(500).json({ error: 'Failed to persist experiment.' });
  }
});

// Server-side Gemini AI: Multi-turn Research Copilot with Search Grounding & Thinking control
app.post('/api/ai/chat', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const messages = req.body?.messages;
    const useSearch = Boolean(req.body?.useSearch);
    const mode = req.body?.mode === 'fast' ? 'fast' : req.body?.mode === 'deep' ? 'deep' : 'standard';

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Conversation messages array is required.' });
    }

    const ai = getGeminiClient();
    const model = mode === 'fast' ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen';

    const historyContents = messages.slice(-12).map((m: { role: string; text: string }) => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(m.text || '').slice(0, 8000) }],
    }));

    const config: Record<string, unknown> = {
      systemInstruction:
        'You are the TEXTPRINT Computational Linguistics & Stylometry Research Copilot. ' +
        'You assist researchers studying human writing behavior, LLM stylometric patterns, Arabic (MSA & Egyptian) and English linguistic structures, and calibrated authorship analysis. ' +
        'CRITICAL SCIENTIFIC RULE: Never claim absolute certainty in AI text detection; always frame authorship scores as probabilistic evidence with confidence intervals, confounding factors (editing, translation, domain, short length), and methodological rigor.',
    };

    if (useSearch) {
      config.tools = [{ googleSearch: {} }];
    }
    if (mode === 'deep') {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
    }

    const response = await ai.models.generateContent({
      model,
      contents: historyContents,
      config,
    });

    const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const groundingSources = rawChunks
      .map((c: { web?: { uri?: string; title?: string } }) => c.web)
      .filter((w): w is { uri: string; title: string } => Boolean(w?.uri));

    res.json({
      text: response.text ?? '',
      modelUsed: model,
      groundingSources,
    });
  } catch (error) {
    console.error('Gemini chat error:', error);
    res.status(502).json({
      error:
        error instanceof Error
          ? error.message
          : 'Gemini API request failed. Please check Settings > Secrets.',
    });
  }
});

// Server-side Gemini AI: High-Thinking Deep Stylometric Analysis
app.post('/api/ai/analyze-deep', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const text = String(req.body?.text || '').trim();
    const metricsSummary = req.body?.metricsSummary ?? {};
    if (text.length < 20) {
      return res.status(400).json({ error: 'Provide at least 20 characters for deep analysis.' });
    }

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents:
        `Analyze the following writing sample from a computational stylometry and linguistics perspective.\n\n` +
        `Measured Metrics:\n${JSON.stringify(metricsSummary, null, 2)}\n\n` +
        `Passage:\n"""\n${text.slice(0, 6000)}\n"""\n\n` +
        `Provide a structured scientific memo covering: (1) syntactic & rhythmic observations, (2) lexical & discourse-marker evidence, (3) potential human-AI co-editing indicators, and (4) key limitations/confounders. Keep the analysis concise (under 350 words) and avoid claiming certainty.`,
      config: {
        systemInstruction:
          'You are a peer-review stylometry analyst. Base observations strictly on textual evidence and measured metrics. Never claim 100% certainty on authorship.',
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      },
    });

    res.json({
      analysis: response.text ?? '',
      modelUsed: 'gemini-4-hydrogen',
      thinkingLevel: 'HIGH',
    });
  } catch (error) {
    console.error('Gemini deep analysis error:', error);
    res.status(502).json({
      error:
        error instanceof Error
          ? error.message
          : 'Gemini deep analysis failed. Please verify API configuration.',
    });
  }
});

// Server-side Gemini AI: Controlled Editing & Generation Laboratory
app.post('/api/ai/edit-transform', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const mode = req.body?.mode === 'generate' ? 'generate' : 'edit';
    const text = String(req.body?.text || '').trim();
    const instruction = String(req.body?.instruction || '').trim();
    const fast = Boolean(req.body?.fast);

    if (mode === 'edit' && text.length < 15) {
      return res.status(400).json({ error: 'Original text must be at least 15 characters.' });
    }
    if (!instruction) {
      return res.status(400).json({ error: 'Editing or generation instruction is required.' });
    }

    const ai = getGeminiClient();
    const model = fast ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen';

    const prompt =
      mode === 'generate'
        ? `Generate a research corpus sample matching this specification:\n${instruction}\nReturn ONLY the generated passage without preamble.`
        : `Apply the following controlled editing operation to the passage below. Return ONLY the edited passage without commentary.\n\nOperation: ${instruction}\n\nOriginal Passage:\n${text.slice(0, 6000)}`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    res.json({
      outputText: (response.text ?? '').trim(),
      modelUsed: model,
      usageMetadata: response.usageMetadata ?? null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Gemini edit/generate error:', error);
    res.status(502).json({
      error:
        error instanceof Error
          ? error.message
          : 'Gemini generation failed.',
    });
  }
});

// Server-side Gemini AI: Google Search Grounded Dataset & Corpus Discovery
app.post('/api/ai/discover-sources', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const queryText = String(req.body?.query || 'open datasets for Arabic and English AI generated text detection stylometry').trim();
    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Find real, publicly documented academic datasets or benchmarks for: ${queryText}. Summarize dataset names, languages, licenses, and access methods concisely.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const groundingSources = rawChunks
      .map((c: { web?: { uri?: string; title?: string } }) => c.web)
      .filter((w): w is { uri: string; title: string } => Boolean(w?.uri));

    res.json({
      summary: response.text ?? '',
      groundingSources,
      modelUsed: 'gemini-4-hydrogen',
    });
  } catch (error) {
    console.error('Gemini source discovery error:', error);
    res.status(502).json({
      error:
        error instanceof Error
          ? error.message
          : 'Search grounding request failed.',
    });
  }
});

// Ensure unmatched /api/* routes and middleware errors always return JSON, never HTML
app.all('/api/*', (_req, res) => {
  res.status(404).json({ error: 'API route not found.' });
});

app.use(
  '/api',
  (
    err: { status?: number; message?: string },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    res.status(err.status || 400).json({
      error: err.message || 'Invalid API request.',
    });
  }
);

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TEXTPRINT laboratory server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
