import pgPromise from 'pg-promise';
import { config } from '.';

const pgp = pgPromise({});

const cn = {
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  ssl: config.db.ssl ? { rejectUnauthorized: false } : undefined,
};

export const db = pgp(cn);
