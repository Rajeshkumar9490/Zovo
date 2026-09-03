import express, { Response } from 'express';
import { db } from '../db/index.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// GET /api/settings - Get user settings
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const s = await db.getUserSettings(userId);

    res.json({
      settings: {
        id: s.id,
        userId: s.user_id,
        theme: s.theme,
        selectedModel: s.selected_model,
        memoryEnabled: Boolean(s.memory_enabled),
        searchEnabled: Boolean(s.search_enabled),
        temperature: s.temperature,
        systemPrompt: s.system_prompt,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
      },
    });
  } catch (error: any) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to retrieve user settings' });
  }
});

// PATCH /api/settings - Update user settings
router.patch('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { theme, selectedModel, memoryEnabled, searchEnabled, temperature, systemPrompt } = req.body;

    const updates: any = {};
    if (theme !== undefined) updates.theme = theme;
    if (selectedModel !== undefined) updates.selected_model = selectedModel;
    if (memoryEnabled !== undefined) updates.memory_enabled = memoryEnabled ? 1 : 0;
    if (searchEnabled !== undefined) updates.search_enabled = searchEnabled ? 1 : 0;
    if (temperature !== undefined) updates.temperature = Math.max(0, Math.min(1, Number(temperature)));
    if (systemPrompt !== undefined) updates.system_prompt = systemPrompt;

    const updated = await db.updateUserSettings(userId, updates);

    res.json({
      settings: {
        id: updated.id,
        userId: updated.user_id,
        theme: updated.theme,
        selectedModel: updated.selected_model,
        memoryEnabled: Boolean(updated.memory_enabled),
        searchEnabled: Boolean(updated.search_enabled),
        temperature: updated.temperature,
        systemPrompt: updated.system_prompt,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      },
    });
  } catch (error: any) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update user settings' });
  }
});

// POST /api/settings/wipe-data - Delete all user conversations, messages, and files
router.post('/wipe-data', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    await db.wipeUserData(userId);
    res.json({ success: true, message: 'All user data wiped successfully.' });
  } catch (error: any) {
    console.error('Error wiping user data:', error);
    res.status(500).json({ error: 'Failed to wipe user data' });
  }
});

export default router;
