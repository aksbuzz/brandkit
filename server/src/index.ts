import cors from 'cors';
import express, { Application, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import http from 'http';
import { config } from './config';
import apiRoutes from './features';
import { requireApiKey } from './middleware/auth';
import { errorHandler } from './middleware/error-handler';

export const app: Application = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());
app.use(
  cors({
    origin: config.app.allowedOrigins,
    credentials: true,
  })
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});
app.use(limiter);

app.get('/health', (_, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/v1', requireApiKey, apiRoutes);

app.use(errorHandler);

const shutdown = (signal: string) => {
  console.log(`Received ${signal}: shutting down...`);
  server.closeAllConnections();
  server.close((err?: Error) => {
    if (err) {
      console.error(`Error closing http server: ${err.message}`);
      process.exit(1);
    }

    console.log('Http server closed');
    process.exit(0);
  });
};

['SIGINT', 'SIGTERM'].forEach(signal => {
  process.on(signal, () => {
    shutdown(signal);
  });
});

const startServer = async () => {
  try {
    server.listen(config.app.port, () => {
      console.log(`Server started on port ${config.app.port}`);
    });
  } catch (error) {
    console.error(`Error starting server: ${(error as Error).message}`);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
