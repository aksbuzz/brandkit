import { createHash, timingSafeEqual } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { config } from '../config';

// Hash both sides so the comparison is constant-time regardless of the supplied key's length.
const digest = (value: string) => createHash('sha256').update(value).digest();
const expectedDigest = digest(config.app.apiKey);

export const requireApiKey = (req: Request, res: Response, next: NextFunction) => {
  const key = req.header('x-api-key');
  if (!key || !timingSafeEqual(digest(key), expectedDigest)) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
};
