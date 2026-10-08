import pgPromise from 'pg-promise';
import rdsCaBundle from '../../../infrastructure/certs/rds-global-bundle.pem';

const pgp = pgPromise({});

export const db = pgp({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT!, 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // Verify the RDS certificate against the bundled CA list instead of trusting any certificate
  ssl: process.env.DB_SSL === 'true' ? { ca: rdsCaBundle, rejectUnauthorized: true } : undefined,
  // Every concurrent Lambda container holds its own pool; one connection is enough because the
  // handler runs one query at a time and this keeps the total below the database's limit.
  max: 1,
});
