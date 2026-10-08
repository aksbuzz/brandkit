import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { SQSBatchItemFailure, SQSBatchResponse, SQSEvent } from 'aws-lambda';
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

type Variant = {
  preset_id: string;
  s3_key: string;
  width: number;
  height: number;
  content_type: string;
  size_bytes: number;
};

/** Failure that retrying cannot fix (bad image, too large). The asset is marked failed and the message is dropped. */
class PermanentError extends Error {}

const s3 = new S3Client({});
const BUCKET = process.env.BUCKET!;

const SUPPORTED_FORMATS = ['jpeg', 'webp', 'png'] as const;
type OutputFormat = (typeof SUPPORTED_FORMATS)[number];

const MAX_ORIGINAL_BYTES = parseInt(process.env.MAX_ORIGINAL_BYTES ?? '', 10) || 25 * 1024 * 1024;
const MAX_INPUT_PIXELS = 100_000_000;
const MAX_CONCURRENT_RENDERS = 3;
// Derived keys are immutable (they contain the asset and preset ids), so they can be cached for a year
const CACHE_CONTROL = 'public, max-age=31536000, immutable';
const KEY_PATTERN = /^originals\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//i;

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

async function mapWithLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Returns the uploaded objects described by an SQS message body; S3 test events yield none. */
function extractUploads(body: string): { key: string; size?: number }[] {
  const message = JSON.parse(body);
  if (!Array.isArray(message.Records)) {
    console.log(`Ignoring message without Records (${message.Event ?? 'unknown event'})`);
    return [];
  }
  return message.Records.filter(
    (r: any) => r?.s3?.object?.key && String(r.eventName ?? '').startsWith('ObjectCreated')
  ).map((r: any) => ({
    // S3 event keys are URL-encoded with '+' for spaces
    key: decodeURIComponent(String(r.s3.object.key).replace(/\+/g, ' ')),
    size: typeof r.s3.object.size === 'number' ? r.s3.object.size : undefined,
  }));
}

async function renderVariant(
  base: sharp.Sharp,
  preset: Preset,
  assetId: string
): Promise<Variant> {
  const format = preset.format as OutputFormat;
  const extension = format === 'jpeg' ? 'jpg' : format;
  const destKey = `derived/${preset.id}/${assetId}.${extension}`;

  let rendered: { data: Buffer; info: sharp.OutputInfo };
  try {
    rendered = await base
      .clone()
      .resize(preset.width, preset.height, { fit: 'cover' })
      .toFormat(format, { quality: preset.quality })
      .toBuffer({ resolveWithObject: true });
  } catch (error) {
    throw new PermanentError(`Could not render preset "${preset.name}": ${(error as Error).message}`);
  }

  const contentType = `image/${format}`;
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: destKey,
      Body: rendered.data,
      ContentType: contentType,
      CacheControl: CACHE_CONTROL,
    })
  );

  return {
    preset_id: preset.id,
    s3_key: destKey,
    width: rendered.info.width,
    height: rendered.info.height,
    content_type: contentType,
    size_bytes: rendered.info.size,
  };
}

async function renderAsset(assetId: string, key: string, declaredSize?: number): Promise<number> {
  if (declaredSize !== undefined && declaredSize > MAX_ORIGINAL_BYTES) {
    throw new PermanentError(`Original is ${declaredSize} bytes; the limit is ${MAX_ORIGINAL_BYTES} bytes`);
  }

  const presets = (await getPresets()).filter(p => {
    const supported = (SUPPORTED_FORMATS as readonly string[]).includes(p.format);
    if (!supported) console.warn(`Skipping preset ${p.id}: unsupported format "${p.format}"`);
    return supported;
  });

  const originalObject = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  if (!originalObject.Body) {
    throw new Error('Original S3 object has no body');
  }
  if (originalObject.ContentLength !== undefined && originalObject.ContentLength > MAX_ORIGINAL_BYTES) {
    throw new PermanentError(`Original is ${originalObject.ContentLength} bytes; the limit is ${MAX_ORIGINAL_BYTES} bytes`);
  }
  const originalBuffer = await streamToBuffer(originalObject.Body as NodeJS.ReadableStream);

  try {
    await sharp(originalBuffer, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw new PermanentError('The uploaded file is not a valid or supported image');
  }

  // rotate() with no arguments applies the EXIF orientation; sharp strips the tag from the output
  const base = sharp(originalBuffer, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS }).rotate();
  const variants = await mapWithLimit(presets, MAX_CONCURRENT_RENDERS, preset =>
    renderVariant(base, preset, assetId)
  );

  // Upsert: re-processing the same asset (duplicate event, retry) replaces its rows instead of failing
  await db.tx(async t => {
    await t.batch([
      ...variants.map(variant =>
        t.none(
          `INSERT INTO variants (asset_id, preset_id, s3_key, width, height, content_type, size_bytes)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (asset_id, preset_id) DO UPDATE SET
             s3_key = EXCLUDED.s3_key,
             width = EXCLUDED.width,
             height = EXCLUDED.height,
             content_type = EXCLUDED.content_type,
             size_bytes = EXCLUDED.size_bytes`,
          [
            assetId,
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
        "UPDATE assets SET status = 'processed', processing_error = NULL WHERE id = $1 AND status = 'processing'",
        assetId
      ),
    ]);
  });

  return variants.length;
}

async function markFailed(assetId: string, message: string): Promise<void> {
  try {
    await db.none(
      "UPDATE assets SET status = 'failed', processing_error = $1 WHERE id = $2 AND status <> 'deleting'",
      [message, assetId]
    );
  } catch (error) {
    // Never let a failure to record a failure escape and take down the rest of the batch
    console.error(`Could not mark asset ${assetId} as failed: ${(error as Error).message}`);
  }
}

async function processUpload(assetId: string, key: string, declaredSize?: number): Promise<void> {
  // Claim the asset. A finished (processed/deleting) or unknown asset means this is a duplicate
  // delivery or a stale message, so there is nothing to do and the message is acknowledged.
  const claimed = await db.oneOrNone(
    `UPDATE assets SET status = 'processing', processing_error = NULL
      WHERE id = $1 AND status IN ('pending', 'processing', 'failed')
      RETURNING id`,
    assetId
  );
  if (!claimed) {
    console.log(`Asset ${assetId} is unknown or already finished, skipping`);
    return;
  }

  console.log(`Processing asset ${assetId}`);
  try {
    const count = await renderAsset(assetId, key, declaredSize);
    console.log(`Successfully processed asset ${assetId} with ${count} variants`);
  } catch (error) {
    console.error(`Error processing asset ${assetId}: ${(error as Error).message}`);
    if (error instanceof PermanentError) {
      await markFailed(assetId, error.message);
      return; // retrying cannot help: acknowledge the message
    }
    // The raw error can contain internal details, so only a generic message is stored in the database
    await markFailed(assetId, 'Processing failed unexpectedly; it will be retried automatically');
    throw error;
  }
}

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const batchItemFailures: SQSBatchItemFailure[] = [];

  for (const record of event.Records) {
    try {
      for (const upload of extractUploads(record.body)) {
        const match = KEY_PATTERN.exec(upload.key);
        if (!match) {
          console.error(`Ignoring object with unexpected key: ${upload.key}`);
          continue;
        }
        await processUpload(match[1], upload.key, upload.size);
      }
    } catch (error) {
      console.error(`Record ${record.messageId} failed: ${(error as Error).message}`);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
