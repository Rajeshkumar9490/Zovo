import { AVAILABLE_MODEL_IDS, DEFAULT_MODEL_ID, isAvailableModel, normalizeModelId } from '../../src/lib/models.js';
import express, { Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { db } from '../db/index.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

const AssistantSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().default(''),
  instructions: z.string().min(1, 'Instructions are required'),
  model: z.enum(AVAILABLE_MODEL_IDS).default(DEFAULT_MODEL_ID),
  suggestedPrompts: z.array(z.string()).optional().default([]),
  avatar: z.string().optional().default('bot'),
});

// GET /api/assistants - List assistants
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const assistants = await db.getAssistants(userId);

    const formatted = assistants.map((a) => {
      let suggested: string[] = [];
      try {
        suggested = JSON.parse(a.suggested_prompts || '[]');
      } catch {}

      return {
        id: a.id,
        userId: a.user_id,
        name: a.name,
        description: a.description,
        instructions: a.instructions,
        model: normalizeModelId(a.model),
        suggestedPrompts: suggested,
        avatar: a.avatar,
        isSystem: a.user_id === 'system',
        createdAt: a.created_at,
        updatedAt: a.updated_at,
      };
    });

    res.json({ assistants: formatted });
  } catch (error: any) {
    console.error('Error fetching assistants:', error);
    res.status(500).json({ error: 'Failed to retrieve assistants' });
  }
});

// POST /api/assistants - Create assistant
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const parseResult = AssistantSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.issues[0]?.message || 'Invalid assistant config' });
      return;
    }

    const { name, description, instructions, model, suggestedPrompts, avatar } = parseResult.data;

    const assistant = await db.createAssistant({
      id: crypto.randomUUID(),
      user_id: userId,
      name: name.trim(),
      description: description.trim(),
      instructions: instructions.trim(),
      model,
      suggested_prompts: JSON.stringify(suggestedPrompts),
      avatar: avatar || 'bot',
    });

    res.status(201).json({
      assistant: {
        id: assistant.id,
        userId: assistant.user_id,
        name: assistant.name,
        description: assistant.description,
        instructions: assistant.instructions,
        model: normalizeModelId(assistant.model),
        suggestedPrompts,
        avatar: assistant.avatar,
        isSystem: false,
        createdAt: assistant.created_at,
        updatedAt: assistant.updated_at,
      },
    });
  } catch (error: any) {
    console.error('Error creating assistant:', error);
    res.status(500).json({ error: 'Failed to create assistant' });
  }
});

// PATCH /api/assistants/:id - Update assistant
router.patch('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { name, description, instructions, model, suggestedPrompts, avatar } = req.body;

    if (model !== undefined && !isAvailableModel(model)) { res.status(400).json({ error: 'Choose Zovo Fast or Zovo Flex.' }); return; }
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (instructions !== undefined) updates.instructions = instructions;
    if (model !== undefined) updates.model = model;
    if (suggestedPrompts !== undefined) updates.suggested_prompts = JSON.stringify(suggestedPrompts);
    if (avatar !== undefined) updates.avatar = avatar;

    const updated = await db.updateAssistant(id, userId, updates);
    if (!updated) {
      res.status(404).json({ error: 'Assistant not found or cannot edit default system assistant' });
      return;
    }

    let parsedPrompts: string[] = [];
    try {
      parsedPrompts = JSON.parse(updated.suggested_prompts || '[]');
    } catch {}

    res.json({
      assistant: {
        id: updated.id,
        userId: updated.user_id,
        name: updated.name,
        description: updated.description,
        instructions: updated.instructions,
        model: normalizeModelId(updated.model),
        suggestedPrompts: parsedPrompts,
        avatar: updated.avatar,
        isSystem: updated.user_id === 'system',
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      },
    });
  } catch (error: any) {
    console.error('Error updating assistant:', error);
    res.status(500).json({ error: 'Failed to update assistant' });
  }
});

// DELETE /api/assistants - Clear all assistants
router.delete('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    await db.clearAssistants(userId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error clearing assistants:', error);
    res.status(500).json({ error: 'Failed to clear assistants' });
  }
});

// DELETE /api/assistants/:id - Delete assistant
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const success = await db.deleteAssistant(id, userId);
    if (!success) {
      res.status(404).json({ error: 'Assistant not found' });
      return;
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting assistant:', error);
    res.status(500).json({ error: 'Failed to delete assistant' });
  }
});

export default router;
