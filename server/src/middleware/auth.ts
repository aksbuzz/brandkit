import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

export const requireApiKey = (req: Request, res: Response, next: NextFunction) => {
  const key = req.headers['x-api-key'];
  if (!key || key !== config.app.apiKey) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
};
