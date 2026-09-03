import express, { Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { db } from '../db/index.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import {
  streamGeminiChat,
  generateConversationTitle,
  extractCleanErrorMessage,
  ChatHistoryMessage,
} from '../services/gemini.js';
import { GroundingSource, GeminiModelId } from '../../src/types.js';

const router = express.Router();

const ChatRequestSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1, 'Message content cannot be empty'),
  model: z
    .enum([
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-3.1-pro-preview',
      'gemini-3.1-flash-lite',
      'gemini-3-flash-preview',
    ])
    .optional(),
  enableSearch: z.boolean().optional(),
  assistantId: z.string().optional(),
  systemPrompt: z.string().optional(),
  attachments: z
    .array(
      z.object({
        filename: z.string(),
        mimeType: z.string(),
        dataUrl: z.string().optional(),
        base64: z.string().optional(),
        size: z.number().optional(),
      })
    )
    .optional(),
});

// POST /api/chat - Stream conversation with Gemini
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  const parseResult = ChatRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.issues[0]?.message || 'Invalid request' });
    return;
  }

  const {
    conversationId: requestedConvId,
    message: userText,
    model: requestedModel,
    enableSearch: requestedSearch,
    assistantId,
    systemPrompt: overrideSystemPrompt,
    attachments = [],
  } = parseResult.data;

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Helper to send SSE event
  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const userSettings = await db.getUserSettings(userId);
    const selectedModel = (requestedModel || userSettings.selected_model || 'gemini-3.7-flash') as GeminiModelId;
    const isSearchEnabled = requestedSearch !== undefined ? requestedSearch : Boolean(userSettings.search_enabled);

    // 1. Get or Create Conversation
    let conversationId = requestedConvId;
    let conversation = conversationId ? await db.getConversation(conversationId, userId) : undefined;
    let isNewConversation = false;

    if (!conversation) {
      isNewConversation = true;
      conversationId = crypto.randomUUID();
      conversation = await db.createConversation({
        id: conversationId,
        user_id: userId,
        title: 'New Conversation',
        model: selectedModel,
        system_prompt: overrideSystemPrompt || '',
        assistant_id: assistantId || '',
        pinned: 0,
        archived: 0,
      });
    }

    sendEvent('conversation', {
      id: conversation.id,
      title: conversation.title,
      model: conversation.model,
      isNew: isNewConversation,
    });

    // 2. Persist User Message
    const userMessageId = crypto.randomUUID();
    const savedUserMessage = await db.createMessage({
      id: userMessageId,
      conversation_id: conversationId,
      user_id: userId,
      role: 'user',
      content: userText,
      sources: '[]',
      attachments: JSON.stringify(attachments),
    });

    sendEvent('userMessage', {
      id: savedUserMessage.id,
      role: 'user',
      content: savedUserMessage.content,
      attachments,
      createdAt: savedUserMessage.created_at,
    });

    // 3. Build Conversation History
    const previousMessages = await db.getMessages(conversationId);
    // Take last 20 messages for context window
    const recentMessages = previousMessages.slice(-20);

    const formattedHistory: ChatHistoryMessage[] = recentMessages.map((m) => {
      let parsedAtts: any[] = [];
      try {
        parsedAtts = JSON.parse(m.attachments || '[]');
      } catch {}

      return {
        role: m.role as 'user' | 'assistant',
        content: m.content,
        attachments: parsedAtts.map((a) => ({
          mimeType: a.mimeType,
          dataUrl: a.dataUrl,
          base64: a.base64,
        })),
      };
    });

    // 4. Gather Knowledge Base & Memory Context
    let systemInstructionParts: string[] = [];

    // Custom assistant instructions if linked
    if (conversation.assistant_id) {
      const assistant = await db.getAssistant(conversation.assistant_id, userId);
      if (assistant && assistant.instructions) {
        systemInstructionParts.push(`Assistant Role & Instructions:\n${assistant.instructions}`);
      }
    }

    if (overrideSystemPrompt) {
      systemInstructionParts.push(`Custom Instructions:\n${overrideSystemPrompt}`);
    } else if (userSettings.system_prompt) {
      systemInstructionParts.push(`User Custom Instructions:\n${userSettings.system_prompt}`);
    }

    // User Memory injection
    if (userSettings.memory_enabled) {
      const memories = await db.getMemories(userId);
      if (memories.length > 0) {
        const memoryContent = memories.map((m) => `- ${m.content}`).join('\n');
        systemInstructionParts.push(`User Stored Memories & Preferences:\n${memoryContent}`);
      }
    }

    // Knowledge Base retrieval (RAG)
    const docs = await db.getDocuments(userId);
    if (docs.length > 0) {
      const searchTerms = userText.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
      const relevantChunks: string[] = [];

      for (const doc of docs) {
        try {
          const chunks: string[] = JSON.parse(doc.chunks || '[]');
          for (const chunk of chunks) {
            const chunkLower = chunk.toLowerCase();
            const matches = searchTerms.filter((term) => chunkLower.includes(term));
            if (matches.length >= 1) {
              relevantChunks.push(`[From Document: ${doc.filename}]\n${chunk}`);
            }
            if (relevantChunks.length >= 4) break;
          }
        } catch {}
      }

      if (relevantChunks.length > 0) {
        systemInstructionParts.push(
          `Reference Knowledge Documents Context:\n${relevantChunks.join('\n\n---\n\n')}`
        );
      }
    }

    const combinedSystemInstruction = systemInstructionParts.join('\n\n');

    // 5. Generate Assistant Message ID
    const assistantMessageId = crypto.randomUUID();
    let accumulatedContent = '';
    let discoveredSources: GroundingSource[] = [];

    // Stream from Gemini
    await streamGeminiChat({
      model: selectedModel,
      messages: formattedHistory,
      systemInstruction: combinedSystemInstruction,
      enableSearch: isSearchEnabled,
      temperature: userSettings.temperature || 0.7,
      onChunk: (chunkText) => {
        accumulatedContent += chunkText;
        sendEvent('chunk', { text: chunkText });
      },
      onSources: (sources) => {
        discoveredSources = sources;
        sendEvent('sources', sources);
      },
    });

    // 6. Save Assistant Response in Database
    const savedAssistantMsg = await db.createMessage({
      id: assistantMessageId,
      conversation_id: conversationId,
      user_id: userId,
      role: 'assistant',
      content: accumulatedContent,
      sources: JSON.stringify(discoveredSources),
      attachments: '[]',
    });

    sendEvent('complete', {
      id: savedAssistantMsg.id,
      content: accumulatedContent,
      sources: discoveredSources,
      createdAt: savedAssistantMsg.created_at,
    });

    // 7. Auto-generate intelligent conversation title if new
    if (isNewConversation || conversation.title === 'New Conversation') {
      generateConversationTitle(userText)
        .then(async (generatedTitle) => {
          if (generatedTitle && generatedTitle !== 'New Conversation') {
            await db.updateConversation(conversationId, userId, { title: generatedTitle });
            sendEvent('titleUpdate', { conversationId, title: generatedTitle });
          }
        })
        .catch(() => {});
    }

    res.write('event: done\ndata: {}\n\n');
    res.end();
  } catch (error: any) {
    console.error('Chat streaming error:', error);
    const cleanError = extractCleanErrorMessage(error);
    sendEvent('error', {
      message: cleanError,
    });
    res.end();
  }
});

// POST /api/chat/title - Intelligently generate title for a conversation
router.post('/title', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { conversationId, message } = req.body;
    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const title = await generateConversationTitle(message);
    if (conversationId) {
      await db.updateConversation(conversationId, req.user!.id, { title });
    }

    res.json({ title });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to generate title' });
  }
});

export default router;
