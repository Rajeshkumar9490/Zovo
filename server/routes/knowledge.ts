import { usageLimit } from '../middleware/limits.js';
import express, { Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

function chunkText(text: string, chunkSize = 600, overlap = 100): string[] {
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (clean.length <= chunkSize) return [clean];

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < clean.length) {
    let endIndex = startIndex + chunkSize;
    if (endIndex < clean.length) {
      // Try to break on newline or space
      const lastNewline = clean.lastIndexOf('\n', endIndex);
      if (lastNewline > startIndex + chunkSize / 2) {
        endIndex = lastNewline;
      } else {
        const lastSpace = clean.lastIndexOf(' ', endIndex);
        if (lastSpace > startIndex + chunkSize / 2) {
          endIndex = lastSpace;
        }
      }
    }
    const chunk = clean.slice(startIndex, endIndex).trim();
    if (chunk.length > 20) {
      chunks.push(chunk);
    }
    startIndex = endIndex - overlap;
    if (startIndex >= clean.length) break;
  }

  return chunks;
}

// GET /api/knowledge - List all user documents
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const docs = await db.getDocuments(userId);

    const formatted = docs.map((d) => {
      let chunkCount = 0;
      try {
        chunkCount = JSON.parse(d.chunks || '[]').length;
      } catch {}

      return {
        id: d.id,
        userId: d.user_id,
        filename: d.filename,
        mimeType: d.mime_type,
        size: d.size,
        chunkCount,
        status: d.status,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      };
    });

    res.json({ documents: formatted });
  } catch (error: any) {
    console.error('Error fetching knowledge documents:', error);
    res.status(500).json({ error: 'Failed to retrieve knowledge documents' });
  }
});

// POST /api/knowledge/upload - Upload and process document into knowledge base
router.post('/upload', authenticateToken, usageLimit('knowledge', 20, 60), usageLimit('guest-uploads', 5, 86400, true), upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    let extractedText = '';

    if (
      file.mimetype.includes('text') ||
      file.originalname.endsWith('.txt') ||
      file.originalname.endsWith('.md') ||
      file.originalname.endsWith('.csv') ||
      file.mimetype.includes('json')
    ) {
      extractedText = file.buffer.toString('utf-8');
    } else {
      // Basic text extraction from binary stream (removing control chars)
      extractedText = file.buffer
        .toString('utf-8')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ')
        .replace(/\s+/g, ' ');
    }

    if (!extractedText.trim()) {
      res.status(400).json({ error: 'Could not extract readable text from document.' });
      return;
    }

    const chunks = chunkText(extractedText);
    const docId = crypto.randomUUID();

    const doc = await db.createDocument({
      id: docId,
      user_id: userId,
      filename: file.originalname,
      mime_type: file.mimetype,
      size: file.size,
      content: extractedText.slice(0, 100000), // Cap full text preview
      chunks: JSON.stringify(chunks),
      status: 'ready',
    });

    res.status(201).json({
      document: {
        id: doc.id,
        userId: doc.user_id,
        filename: doc.filename,
        mimeType: doc.mime_type,
        size: doc.size,
        chunkCount: chunks.length,
        status: doc.status,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      },
    });
  } catch (error: any) {
    console.error('Knowledge upload error:', error);
    res.status(500).json({ error: 'Failed to process document for Knowledge Base.' });
  }
});

// DELETE /api/knowledge/:id - Delete a document
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const success = await db.deleteDocument(id, userId);
    if (!success) {
      res.status(404).json({ error: 'Document not found or unauthorized' });
      return;
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

export default router;
