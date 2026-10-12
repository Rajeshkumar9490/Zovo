import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import { getSupabaseClient } from '../db/supabase.js';

const localUsage = new Map<string, { used: number; reset: number }>();
// Supabase's atomic counter is shared across serverless instances.
export function usageLimit(action: string, limit: number, windowSeconds: number, guestsOnly = false) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (guestsOnly && !req.user?.email.endsWith('@guest.zovo.ai')) return next();
    const identity = req.user?.id || req.ip || 'unknown';
    const key = `${action}:${identity}`;
    try {
      const client = getSupabaseClient();
      let allowed: boolean;
      if (client) {
        const { data, error } = await client.rpc('consume_usage', { usage_key: key, max_usage: limit, window_seconds: windowSeconds });
        if (error) throw error;
        allowed = data === true;
      } else {
        const now = Date.now();
        for (const [k, value] of localUsage) if (value.reset <= now) localUsage.delete(k);
        const usage = localUsage.get(key) || { used: 0, reset: now + windowSeconds * 1000 };
        allowed = usage.used < limit;
        if (allowed) usage.used++;
        localUsage.set(key, usage);
      }
      if (!allowed) { res.status(429).json({ error: 'Usage limit reached. Please sign in or try again later.' }); return; }
      next();
    } catch (error) {
      console.error('Usage limit unavailable:', error);
      res.status(503).json({ error: 'Zovo is temporarily unavailable. Please try again shortly.' });
    }
  };
}
