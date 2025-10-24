import { Request, Response, NextFunction } from 'express';

export const errorHandler = (error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(error);
  if (error.name === 'QueryResultError' && error.message.includes('No data returned')) {
    return res.status(404).json({ message: 'Resource not found' });
  }
  if (error.message.includes('violates foreign key constraint')) {
    return res.status(409).json({ message: 'Conflict: This resource is still in use.' });
  }
  res.status(500).json({ message: 'Internal Server Error' });
};
