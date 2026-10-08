import { NextFunction, Request, Response } from 'express';
import pgPromise from 'pg-promise';

const { QueryResultError, queryResultErrorCode } = pgPromise.errors;

// PostgreSQL SQLSTATE codes we translate into client errors
const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';
const PG_INVALID_TEXT_REPRESENTATION = '22P02';

type HttpLikeError = Error & { code?: unknown; status?: number; expose?: boolean };

export const errorHandler = (error: HttpLikeError, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof QueryResultError && error.code === queryResultErrorCode.noData) {
    return res.status(404).json({ message: 'Resource not found' });
  }
  if (error.code === PG_UNIQUE_VIOLATION) {
    return res.status(409).json({ message: 'Conflict: A resource with the same unique value already exists.' });
  }
  if (error.code === PG_FOREIGN_KEY_VIOLATION) {
    return res.status(409).json({ message: 'Conflict: This resource is still in use.' });
  }
  if (error.code === PG_INVALID_TEXT_REPRESENTATION) {
    return res.status(400).json({ message: 'Invalid input' });
  }
  // Client errors raised by middleware (malformed JSON, payload too large, ...)
  if (error.expose && error.status && error.status >= 400 && error.status < 500) {
    return res.status(error.status).json({ message: error.message });
  }

  console.error(error);
  res.status(500).json({ message: 'Internal Server Error' });
};
