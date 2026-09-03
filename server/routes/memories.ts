import express, { Response } from 'express';
import { db } from '../db/index.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// GET /api/memories - List all user memories
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const memories = await db.getMemories(userId);

    res.json({
      memories: memories.map((m) => ({
        id: m.id,
        userId: m.user_id,
        content: m.content,
        createdAt: m.created_at,
        updatedAt: m.updated_at,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching memories:', error);
    res.status(500).json({ error: 'Failed to retrieve memories' });
  }
});

// POST /api/memories - Add a memory
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { content } = req.body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      res.status(400).json({ error: 'Memory content cannot be empty' });
      return;
    }

    const memory = await db.createMemory(userId, content.trim());
    res.status(201).json({
      memory: {
        id: memory.id,
        userId: memory.user_id,
        content: memory.content,
        createdAt: memory.created_at,
        updatedAt: memory.updated_at,
      },
    });
  } catch (error: any) {
    console.error('Error creating memory:', error);
    res.status(500).json({ error: 'Failed to create memory' });
  }
});

// DELETE /api/memories/:id - Delete a single memory
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const success = await db.deleteMemory(id, userId);
    if (!success) {
      res.status(404).json({ error: 'Memory not found' });
      return;
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting memory:', error);
    res.status(500).json({ error: 'Failed to delete memory' });
  }
});

// DELETE /api/memories - Clear all memories
router.delete('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    await db.clearMemories(userId);
    res.json({ success: true, message: 'All memories cleared' });
  } catch (error: any) {
    console.error('Error clearing memories:', error);
    res.status(500).json({ error: 'Failed to clear memories' });
  }
});

export default router;
