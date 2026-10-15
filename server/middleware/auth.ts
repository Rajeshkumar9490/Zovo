import { Request, Response, NextFunction } from 'express';
import 'dotenv/config';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';

if ((process.env.NODE_ENV === 'production' || process.env.VERCEL) && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('Set JWT_SECRET to a random secret of at least 32 characters.');
}
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export function generateToken(user: AuthenticatedUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  let decoded: AuthenticatedUser;
  try {
    decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
    if (!decoded || typeof decoded.id !== 'string' || !decoded.id) throw new Error('Invalid token payload');
  } catch {
    res.status(401).json({ error: 'Invalid or expired token.' });
    return;
  }

  try {
    const user = await db.getUserById(decoded.id);
    if (!user || user.id === 'demo-user-zovo' || user.email === 'guest@zovo.ai') {
      res.status(401).json({ error: 'Session expired or user not found.' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    };
    next();
  } catch {
    res.setHeader('Retry-After', '5');
    res.status(503).json({ error: 'Session verification is temporarily unavailable. Please retry.' });
  }
}

export async function optionalAuthenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
      const user = await db.getUserById(decoded.id);
      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
        };
      }
    } catch {
      // Ignore optional auth error
    }
  }
  next();
}
