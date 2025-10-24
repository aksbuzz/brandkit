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
    sqs: {
      deleteQueueUrl: getEnv('AWS_SQS_DELETE_QUEUE_URL'),
    },
  },
};
