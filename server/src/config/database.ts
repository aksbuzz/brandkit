import fs from 'fs';
import pgPromise from 'pg-promise';
import { config } from '.';

export const pgp = pgPromise({});

// BIGINT (OID 20) arrives as a string by default; asset sizes are far below 2^53, so return numbers
pgp.pg.types.setTypeParser(20, value => parseInt(value, 10));

const buildSsl = () => {
  if (!config.db.ssl) return undefined;
  if (config.db.sslCaPath) {
    return { ca: fs.readFileSync(config.db.sslCaPath, 'utf8'), rejectUnauthorized: true };
  }
  console.warn('DB_SSL is enabled without DB_SSL_CA_PATH: the server certificate will NOT be verified');
  return { rejectUnauthorized: false };
};

export const db = pgp({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  ssl: buildSsl(),
  max: config.db.poolMax,
});
