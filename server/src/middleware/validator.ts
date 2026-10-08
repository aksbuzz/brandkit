import { NextFunction, Request, Response } from 'express';
import { ZodType } from 'zod';

type Validated = { body?: unknown; query?: unknown; params?: unknown };

/**
 * Validates { body, query, params } against the schema.
 *
 * The parsed result (defaults applied, unknown keys stripped, strings coerced) replaces
 * `req.body` and is exposed as `res.locals.validated` for query and params, because
 * `req.query` is read-only in Express 5.
 */
export const validate =
  (schema: ZodType) => (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      return res.status(400).json({ status: 'fail', errors: result.error.issues });
    }

    const parsed = result.data as Validated;
    if (parsed.body !== undefined) {
      req.body = parsed.body;
    }
    res.locals.validated = parsed;
    next();
  };
