import express, { Response } from 'express';
import { db } from '../db/index.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// PATCH /api/messages/:id - Edit message content
router.patch('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { content } = req.body;

    const msg = await db.getMessage(id);
    if (!msg || msg.user_id !== userId) {
      res.status(404).json({ error: 'Message not found or unauthorized' });
      return;
    }

    const updated = await db.updateMessage(id, content);
    res.json({ message: updated });
  } catch (error: any) {
    console.error('Error editing message:', error);
    res.status(500).json({ error: 'Failed to update message' });
  }
});

// DELETE /api/messages/:id - Delete a message
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const success = await db.deleteMessage(id, userId);
    if (!success) {
      res.status(404).json({ error: 'Message not found or unauthorized' });
      return;
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

export default router;
