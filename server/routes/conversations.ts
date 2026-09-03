import express, { Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// GET /api/conversations - List all conversations for the user
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const includeArchived = req.query.archived === 'true';
    const search = typeof req.query.search === 'string' ? req.query.search.toLowerCase() : '';

    let convs = await db.getConversations(userId, includeArchived);

    if (search) {
      convs = convs.filter((c) => c.title.toLowerCase().includes(search));
    }

    // Attach last message preview and message count
    const enriched = await Promise.all(
      convs.map(async (c) => {
        const messages = await db.getMessages(c.id);
        const lastMsg = messages[messages.length - 1];
        return {
          id: c.id,
          userId: c.user_id,
          title: c.title,
          model: c.model,
          systemPrompt: c.system_prompt,
          assistantId: c.assistant_id,
          pinned: Boolean(c.pinned),
          archived: Boolean(c.archived),
          createdAt: c.created_at,
          updatedAt: c.updated_at,
          lastMessagePreview: lastMsg ? lastMsg.content.slice(0, 100) : '',
          messageCount: messages.length,
        };
      })
    );

    res.json({ conversations: enriched });
  } catch (error: any) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// POST /api/conversations - Create a new empty conversation
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { title, model, systemPrompt, assistantId } = req.body;

    const conv = await db.createConversation({
      id: crypto.randomUUID(),
      user_id: userId,
      title: title?.trim() || 'New Conversation',
      model: model || 'gemini-3.7-flash',
      system_prompt: systemPrompt || '',
      assistant_id: assistantId || '',
      pinned: 0,
      archived: 0,
    });

    res.status(201).json({
      conversation: {
        id: conv.id,
        userId: conv.user_id,
        title: conv.title,
        model: conv.model,
        systemPrompt: conv.system_prompt,
        assistantId: conv.assistant_id,
        pinned: Boolean(conv.pinned),
        archived: Boolean(conv.archived),
        createdAt: conv.created_at,
        updatedAt: conv.updated_at,
      },
    });
  } catch (error: any) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// GET /api/conversations/:id - Get conversation with messages
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const conv = await db.getConversation(id, userId);
    if (!conv) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const rawMessages = await db.getMessages(id);
    const messages = rawMessages.map((m) => {
      let parsedSources = [];
      let parsedAttachments = [];
      try {
        parsedSources = JSON.parse(m.sources || '[]');
      } catch {}
      try {
        parsedAttachments = JSON.parse(m.attachments || '[]');
      } catch {}

      return {
        id: m.id,
        conversationId: m.conversation_id,
        userId: m.user_id,
        role: m.role,
        content: m.content,
        sources: parsedSources,
        attachments: parsedAttachments,
        createdAt: m.created_at,
        updatedAt: m.updated_at,
        status: 'complete',
      };
    });

    res.json({
      conversation: {
        id: conv.id,
        userId: conv.user_id,
        title: conv.title,
        model: conv.model,
        systemPrompt: conv.system_prompt,
        assistantId: conv.assistant_id,
        pinned: Boolean(conv.pinned),
        archived: Boolean(conv.archived),
        createdAt: conv.created_at,
        updatedAt: conv.updated_at,
      },
      messages,
    });
  } catch (error: any) {
    console.error('Error getting conversation:', error);
    res.status(500).json({ error: 'Failed to retrieve conversation' });
  }
});

// PATCH /api/conversations/:id - Update title, model, pinned, archived
router.patch('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { title, model, systemPrompt, pinned, archived } = req.body;

    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (model !== undefined) updates.model = model;
    if (systemPrompt !== undefined) updates.system_prompt = systemPrompt;
    if (pinned !== undefined) updates.pinned = pinned ? 1 : 0;
    if (archived !== undefined) updates.archived = archived ? 1 : 0;

    const updated = await db.updateConversation(id, userId, updates);
    if (!updated) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    res.json({
      conversation: {
        id: updated.id,
        userId: updated.user_id,
        title: updated.title,
        model: updated.model,
        systemPrompt: updated.system_prompt,
        assistantId: updated.assistant_id,
        pinned: Boolean(updated.pinned),
        archived: Boolean(updated.archived),
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      },
    });
  } catch (error: any) {
    console.error('Error updating conversation:', error);
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

// DELETE /api/conversations/:id - Delete conversation and its messages
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const success = await db.deleteConversation(id, userId);
    if (!success) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    res.json({ success: true, message: 'Conversation deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

export default router;
