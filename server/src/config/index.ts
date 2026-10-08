import dotenv from 'dotenv';

dotenv.config();

const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

const getInt = (key: string, fallback: number): number => {
  const raw = process.env[key];
  if (!raw) return fallback;
  const value = parseInt(raw, 10);
  if (Number.isNaN(value)) {
    throw new Error(`Environment variable ${key} must be an integer`);
  }
  return value;
};

export const config = {
  app: {
    port: parseInt(getEnv('PORT'), 10),
    apiKey: getEnv('API_KEY'),
    allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5173,http://localhost')
      .split(',')
      .map(o => o.trim()),
    // Number of reverse proxies in front of the app (CloudFront = 1). Unset when the app is
    // reachable directly, otherwise client IPs (and rate limiting) are taken from a spoofable header.
    trustProxy: process.env.TRUST_PROXY ? getInt('TRUST_PROXY', 0) : undefined,
  },
  upload: {
    maxBytes: getInt('MAX_UPLOAD_BYTES', 10 * 1024 * 1024),
  },
  db: {
    host: getEnv('DB_HOST'),
    port: parseInt(getEnv('DB_PORT'), 10),
    user: getEnv('DB_USER'),
    password: getEnv('DB_PASSWORD'),
    database: getEnv('DB_DATABASE'),
    ssl: process.env.DB_SSL === 'true',
    // PEM bundle used to verify the server certificate (the RDS global bundle is in infrastructure/certs)
    sslCaPath: process.env.DB_SSL_CA_PATH,
    poolMax: getInt('DB_POOL_MAX', 10),
  },
  aws: {
    region: getEnv('AWS_REGION'),
    s3: {
      bucket: getEnv('AWS_S3_BUCKET_NAME'),
    },
    cloudfront: {
      domainName: getEnv('AWS_CLOUDFRONT_DOMAIN_NAME'),
    },
  },
};
