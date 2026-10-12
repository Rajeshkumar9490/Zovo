import { usageLimit } from '../middleware/limits.js';
import express, { Response } from 'express';
import multer from 'multer';
import { getGeminiClient } from '../services/gemini.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// POST /api/voice/transcribe - Transcribe uploaded audio using Gemini
router.post('/transcribe', authenticateToken, usageLimit('voice', 20, 60), upload.single('audio'), async (req: AuthRequest, res: Response) => {
  try {
    const file = req.file;
    const bodyAudio = req.body?.audioBase64;
    const bodyMime = req.body?.mimeType;

    if (!file && !bodyAudio) {
      res.status(400).json({ error: 'No audio file provided' });
      return;
    }

    const ai = getGeminiClient();
    const base64Audio = file ? file.buffer.toString('base64') : bodyAudio;
    const mimeType = (file ? file.mimetype : bodyMime) || 'audio/webm';

    const audioPart = {
      inlineData: {
        mimeType: mimeType.startsWith('audio/') ? mimeType : 'audio/webm',
        data: base64Audio,
      },
    };

    // Use verified high-throughput multimodal models
    let transcript = '';
    const transcribeModels = ['gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-3-flash-preview', 'gemini-3.7-flash'];

    for (const m of transcribeModels) {
      try {
        const response = await ai.models.generateContent({
          model: m,
          contents: { parts: [audioPart, { text: 'Transcribe this spoken audio accurately. Output only the transcribed text.' }] },
        });
        transcript = response.text?.trim() || '';
        if (transcript) break;
      } catch {
        // Try next fallback model
      }
    }

    res.json({ transcript: transcript || 'Audio received.' });
  } catch (error: any) {
    console.error('Transcription error:', error);
    res.status(500).json({ error: 'Audio transcription failed. You can also use browser speech recognition or type directly.' });
  }
});

export default router;
