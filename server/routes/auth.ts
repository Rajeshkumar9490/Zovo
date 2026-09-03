import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { db } from '../db/index.js';
import { generateToken, authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const parseResult = RegisterSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.issues[0]?.message || 'Invalid input' });
      return;
    }

    const { email, password, name } = parseResult.data;
    const existing = await db.getUserByEmail(email);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const userId = crypto.randomUUID();

    const user = await db.createUser({
      id: userId,
      email: email.toLowerCase().trim(),
      password_hash: passwordHash,
      name: name.trim(),
      avatar: '',
    });

    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        createdAt: user.created_at,
      },
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const parseResult = LoginSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.issues[0]?.message || 'Invalid credentials' });
      return;
    }

    const { email, password } = parseResult.data;
    const user = await db.getUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        createdAt: user.created_at,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Sign in failed. Please try again.' });
  }
});

// POST /api/auth/demo (Fast sandbox login for immediate preview)
router.post('/demo', async (req: Request, res: Response) => {
  try {
    const demoEmail = 'guest@zovo.ai';
    let user = await db.getUserByEmail(demoEmail);

    if (!user) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('zovo-demo-password', salt);
      user = await db.createUser({
        id: 'demo-user-zovo',
        email: demoEmail,
        password_hash: passwordHash,
        name: 'Guest',
        avatar: '',
      });
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        createdAt: user.created_at,
      },
    });
  } catch (error: any) {
    console.error('Demo auth error:', error);
    res.status(500).json({ error: 'Demo sign in failed.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    },
  });
});

// PATCH /api/auth/profile
router.patch('/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { name, avatar, currentPassword, newPassword } = req.body;
    const userId = req.user!.id;
    const user = await db.getUserById(userId);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const updates: any = {};
    if (name && typeof name === 'string' && name.trim().length >= 2) {
      updates.name = name.trim();
    }
    if (avatar !== undefined && typeof avatar === 'string') {
      updates.avatar = avatar;
    }

    if (newPassword && typeof newPassword === 'string') {
      if (!currentPassword) {
        res.status(400).json({ error: 'Current password is required to change password' });
        return;
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isMatch) {
        res.status(400).json({ error: 'Current password is incorrect' });
        return;
      }
      const salt = await bcrypt.genSalt(10);
      updates.password_hash = await bcrypt.hash(newPassword, salt);
    }

    const updated = await db.updateUser(userId, updates);

    res.json({
      user: {
        id: updated?.id,
        email: updated?.email,
        name: updated?.name,
        avatar: updated?.avatar,
      },
    });
  } catch (err: any) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
