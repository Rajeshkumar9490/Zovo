import express, { Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import {
  uploadAttachmentFile,
  getAttachmentFileBuffer,
  deleteAttachmentFile,
} from '../services/supabaseStorage.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'image/gif',
      'application/pdf',
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/json',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (
      allowedMimeTypes.includes(file.mimetype) ||
      file.originalname.endsWith('.md') ||
      file.originalname.endsWith('.txt')
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          'Unsupported file format. Supported: PNG, JPG, WEBP, PDF, TXT, MD, DOCX, CSV, JSON'
        )
      );
    }
  },
});

// POST /api/attachments/upload - Upload file to Supabase Storage (or local fallback)
router.post(
  '/upload',
  authenticateToken,
  upload.single('file'),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const fileId = crypto.randomUUID();
      const isImage = file.mimetype.startsWith('image/');
      const isText =
        file.mimetype.startsWith('text/') ||
        file.originalname.endsWith('.md') ||
        file.originalname.endsWith('.txt') ||
        file.mimetype === 'application/json' ||
        file.mimetype === 'text/csv';

      let textPreview = '';
      let base64Data = '';
      let dataUrl = '';

      if (isImage) {
        base64Data = file.buffer.toString('base64');
        dataUrl = `data:${file.mimetype};base64,${base64Data}`;
      } else if (isText) {
        textPreview = file.buffer.toString('utf-8').slice(0, 50000);
      }

      // Upload file to Supabase storage (private user path) or local disk
      const uploadResult = await uploadAttachmentFile(
        userId,
        fileId,
        file.originalname,
        file.buffer,
        file.mimetype
      );

      // Store metadata in database
      const attachment = await db.createAttachment({
        id: fileId,
        user_id: userId,
        conversation_id: (req.body.conversationId as string) || '',
        filename: file.originalname,
        mime_type: file.mimetype,
        size: file.size,
        storage_path: uploadResult.storagePath,
        status: 'ready',
      });

      res.status(201).json({
        attachment: {
          id: attachment.id,
          filename: attachment.filename,
          mimeType: attachment.mime_type,
          size: attachment.size,
          dataUrl: isImage ? dataUrl : undefined,
          base64: isImage ? base64Data : undefined,
          textPreview: isText ? textPreview : undefined,
        },
      });
    } catch (error: any) {
      console.error('File upload error:', error);
      res.status(500).json({ error: error?.message || 'File upload failed' });
    }
  }
);

// GET /api/attachments/:id - Retrieve uploaded file with ownership verification
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const attachment = await db.getAttachment(id, userId);
    if (!attachment) {
      res.status(404).json({ error: 'Attachment not found or unauthorized' });
      return;
    }

    const fileResult = await getAttachmentFileBuffer(userId, attachment.storage_path);
    if (!fileResult) {
      res.status(404).json({ error: 'Attachment file could not be retrieved' });
      return;
    }

    res.setHeader('Content-Type', attachment.mime_type || fileResult.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(attachment.filename)}"`
    );
    res.send(fileResult.buffer);
  } catch (err: any) {
    console.error('Attachment retrieve error:', err);
    res.status(404).json({ error: 'Attachment file not found' });
  }
});

// DELETE /api/attachments/:id - Delete an attachment file and metadata
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const attachment = await db.getAttachment(id, userId);
    if (!attachment) {
      res.status(404).json({ error: 'Attachment not found or unauthorized' });
      return;
    }

    // Delete remote/local file
    await deleteAttachmentFile(userId, attachment.storage_path);

    // Delete record from database
    await db.deleteAttachment(id, userId);

    res.json({ success: true, message: 'Attachment deleted successfully' });
  } catch (err: any) {
    console.error('Attachment delete error:', err);
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

export default router;
