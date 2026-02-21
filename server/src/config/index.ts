import dotenv from 'dotenv';

dotenv.config();

const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
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
  },
  db: {
    host: getEnv('DB_HOST'),
    port: parseInt(getEnv('DB_PORT'), 10),
    user: getEnv('DB_USER'),
    password: getEnv('DB_PASSWORD'),
    database: getEnv('DB_DATABASE'),
    ssl: process.env.DB_SSL === 'true',
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
