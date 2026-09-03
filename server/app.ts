import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRouter from './routes/auth.js';
import chatRouter from './routes/chat.js';
import conversationsRouter from './routes/conversations.js';
import messagesRouter from './routes/messages.js';
import attachmentsRouter from './routes/attachments.js';
import knowledgeRouter from './routes/knowledge.js';
import memoriesRouter from './routes/memories.js';
import promptsRouter from './routes/prompts.js';
import assistantsRouter from './routes/assistants.js';
import settingsRouter from './routes/settings.js';
import voiceRouter from './routes/voice.js';
import path from 'path';
import fs from 'fs';

dotenv.config();

export const app = express();

// Security & Parsing Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health Check API
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'zovo-api',
    deployment: process.env.VERCEL ? 'vercel-serverless' : 'standard-node',
    supabaseConnected: Boolean(process.env.SUPABASE_URL),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// Raw Supabase SQL Schema endpoint for easy setup & copy-paste
app.get('/api/schema.sql', (_req: Request, res: Response) => {
  const schemaPath = path.join(process.cwd(), 'supabase', 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="schema.sql"');
    res.sendFile(schemaPath);
  } else {
    res.status(404).send('-- Schema file not found');
  }
});

// Download Project ZIP file endpoint
app.get('/api/download-zip', (_req: Request, res: Response) => {
  const zipPath = path.join(process.cwd(), 'zovo-project.zip');
  if (fs.existsSync(zipPath)) {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="zovo-project.zip"');
    res.sendFile(zipPath);
  } else {
    res.status(404).json({ error: 'ZIP file not found' });
  }
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/chat', chatRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/attachments', attachmentsRouter);
app.use('/api/knowledge', knowledgeRouter);
app.use('/api/memories', memoriesRouter);
app.use('/api/prompts', promptsRouter);
app.use('/api/assistants', assistantsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/voice', voiceRouter);

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled API Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error occurred',
  });
});

export default app;
