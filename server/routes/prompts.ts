import express, { Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { db } from '../db/index.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

const PromptSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().default(''),
  content: z.string().min(1, 'Prompt content is required'),
  category: z.string().optional().default('Custom'),
  isFavorite: z.boolean().optional().default(false),
});

// GET /api/prompts - List prompts (user's + system starter prompts)
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const prompts = await db.getPrompts(userId);

    const formatted = prompts.map((p) => ({
      id: p.id,
      userId: p.user_id,
      name: p.name,
      description: p.description,
      content: p.content,
      category: p.category,
      isFavorite: Boolean(p.is_favorite),
      isSystem: Boolean(p.is_system),
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));

    res.json({ prompts: formatted });
  } catch (error: any) {
    console.error('Error fetching prompts:', error);
    res.status(500).json({ error: 'Failed to retrieve prompts' });
  }
});

// POST /api/prompts - Create a prompt
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const parseResult = PromptSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.issues[0]?.message || 'Invalid prompt' });
      return;
    }

    const { name, description, content, category, isFavorite } = parseResult.data;

    const prompt = await db.createPrompt({
      id: crypto.randomUUID(),
      user_id: userId,
      name: name.trim(),
      description: description.trim(),
      content: content.trim(),
      category: category.trim() || 'General',
      is_favorite: isFavorite ? 1 : 0,
      is_system: 0,
    });

    res.status(201).json({
      prompt: {
        id: prompt.id,
        userId: prompt.user_id,
        name: prompt.name,
        description: prompt.description,
        content: prompt.content,
        category: prompt.category,
        isFavorite: Boolean(prompt.is_favorite),
        isSystem: false,
        createdAt: prompt.created_at,
        updatedAt: prompt.updated_at,
      },
    });
  } catch (error: any) {
    console.error('Error creating prompt:', error);
    res.status(500).json({ error: 'Failed to create prompt' });
  }
});

// PATCH /api/prompts/:id - Update a prompt
router.patch('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { name, description, content, category, isFavorite } = req.body;

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (content !== undefined) updates.content = content;
    if (category !== undefined) updates.category = category;
    if (isFavorite !== undefined) updates.is_favorite = isFavorite ? 1 : 0;

    const updated = await db.updatePrompt(id, userId, updates);
    if (!updated) {
      res.status(404).json({ error: 'Prompt not found or cannot edit system prompts' });
      return;
    }

    res.json({
      prompt: {
        id: updated.id,
        userId: updated.user_id,
        name: updated.name,
        description: updated.description,
        content: updated.content,
        category: updated.category,
        isFavorite: Boolean(updated.is_favorite),
        isSystem: Boolean(updated.is_system),
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      },
    });
  } catch (error: any) {
    console.error('Error updating prompt:', error);
    res.status(500).json({ error: 'Failed to update prompt' });
  }
});

// DELETE /api/prompts/:id - Delete a prompt
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const success = await db.deletePrompt(id, userId);
    if (!success) {
      res.status(404).json({ error: 'Prompt not found or cannot delete system prompt' });
      return;
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting prompt:', error);
    res.status(500).json({ error: 'Failed to delete prompt' });
  }
});

export default router;
