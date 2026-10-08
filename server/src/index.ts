import cors from 'cors';
import express, { Application, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import http from 'http';
import { config } from './config';
import { db, pgp } from './config/database';
import apiRoutes from './features';
import { requireApiKey } from './middleware/auth';
import { errorHandler } from './middleware/error-handler';

export const app: Application = express();
const server = http.createServer(app);

if (config.app.trustProxy !== undefined) {
  app.set('trust proxy', config.app.trustProxy);
}

app.use(helmet());
app.use(cors({ origin: config.app.allowedOrigins }));

// Registered before the rate limiter so load balancer or monitoring probes are never throttled
app.get('/health', async (_req: Request, res: Response) => {
  try {
    await db.one('SELECT 1 AS ok');
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Health check failed', error);
    res.status(503).json({ status: 'unavailable' });
  }
});

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later.' },
  })
);

app.use(express.json());

app.use('/api/v1', requireApiKey, apiRoutes);

app.use(errorHandler);

const FORCE_SHUTDOWN_AFTER_MS = 10_000;
let shuttingDown = false;

const shutdown = (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}: shutting down...`);

  // Let in-flight requests finish; only cut connections that are still open after the grace period
  const forceTimer = setTimeout(() => {
    console.error('Grace period elapsed, closing remaining connections');
    server.closeAllConnections();
  }, FORCE_SHUTDOWN_AFTER_MS);
  forceTimer.unref();

  server.close(async (err?: Error) => {
    clearTimeout(forceTimer);
    pgp.end();
    if (err) {
      console.error(`Error closing http server: ${err.message}`);
      process.exit(1);
    }
    console.log('Http server closed');
    process.exit(0);
  });
  server.closeIdleConnections();
};

['SIGINT', 'SIGTERM'].forEach(signal => {
  process.on(signal, () => shutdown(signal));
});

if (process.env.NODE_ENV !== 'test') {
  server.on('error', (error: Error) => {
    console.error(`Error starting server: ${error.message}`);
    process.exit(1);
  });
  server.listen(config.app.port, () => {
    console.log(`Server started on port ${config.app.port}`);
  });
}
