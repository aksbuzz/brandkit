import { SQSBatchResponse, SQSEvent } from 'aws-lambda';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { db } from './db';

type Preset = {
  id: string;
  name: string;
  width: number;
  height: number;
  format: string;
  quality: number;
};

const s3 = new S3Client({});
const BUCKET = process.env.BUCKET!;

// Module-level cache shared across warm Lambda invocations
let cachedPresets: Preset[] | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getPresets(): Promise<Preset[]> {
  if (cachedPresets && Date.now() < cacheExpiresAt) {
    return cachedPresets;
  }
  cachedPresets = await db.manyOrNone<Preset>('SELECT * FROM presets');
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  return cachedPresets;
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

async function processRecord(key: string, assetId: string): Promise<void> {
  console.log(`Processing asset ${assetId}`);

  // Clear any previous error and mark as processing
  await db.none(
    "UPDATE assets SET status = 'processing', processing_error = NULL, updated_at = NOW() WHERE id = $1",
    assetId
  );

  const presets = await getPresets();

  const getObjectCmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const originalObject = await s3.send(getObjectCmd);
  if (!originalObject.Body) {
    throw new Error('Original S3 object has no body');
  }
  const originalBuffer = await streamToBuffer(originalObject.Body as NodeJS.ReadableStream);

  const variantResults = await Promise.all(
    presets.map(async preset => {
      const transformer = sharp(originalBuffer).resize(preset.width, preset.height);
      if (preset.format) {
        transformer.toFormat(preset.format as any, { quality: preset.quality });
      }
      const outBuffer = await transformer.toBuffer();
      const fileName = key.split('/').pop();
      const destKey = `derived/${preset.name}/${assetId}/${fileName}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: destKey,
          Body: outBuffer,
          ContentType: `image/${preset.format}`,
        })
      );

      return {
        asset_id: assetId,
        preset_id: preset.id,
        s3_key: destKey,
        width: preset.width,
        height: preset.height,
        content_type: `image/${preset.format}`,
        size_bytes: outBuffer.length,
      };
    })
  );

  await db.tx(async t => {
    await t.batch([
      ...variantResults.map(variant =>
        t.none(
          'INSERT INTO variants (asset_id, preset_id, s3_key, width, height, content_type, size_bytes) \
          VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [
            variant.asset_id,
            variant.preset_id,
            variant.s3_key,
            variant.width,
            variant.height,
            variant.content_type,
            variant.size_bytes,
          ]
        )
      ),
      t.none(
        "UPDATE assets SET status = 'processed', updated_at = NOW() WHERE id = $1",
        assetId
      ),
    ]);
  });

  console.log(`Successfully processed asset ${assetId} with ${variantResults.length} variants`);
}

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    let assetId: string | undefined;
    try {
      const s3Notification = JSON.parse(record.body);
      const s3Record = s3Notification.Records[0].s3;
      const key = decodeURIComponent(s3Record.object.key.replace(/\+/g, ' '));

      assetId = key.split('/')[1];
      if (!assetId) {
        console.error('Invalid message body, missing assetId', record.body);
        // Poison-pill message: report as failure so SQS retries up to maxReceiveCount
        batchItemFailures.push({ itemIdentifier: record.messageId });
        continue;
      }

      await processRecord(key, assetId);
    } catch (error) {
      console.error(
        `Error processing record ${record.messageId} (asset ${assetId}): ${(error as Error).message}`
      );
      if (assetId) {
        await db.none(
          "UPDATE assets SET status = 'failed', processing_error = $1, updated_at = NOW() WHERE id = $2",
          [(error as Error).message, assetId]
        );
      }
      // Report only this record as failed; other records in the batch succeed normally
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
