import { SQSEvent } from 'aws-lambda';
import { db } from './db';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';

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

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    stream.on('data', chunk => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

export const handler = async (event: SQSEvent): Promise<void> => {
  for (const record of event.Records) {
    const s3Notification = JSON.parse(record.body);
    const s3Record = s3Notification.Records[0].s3;
    const key = decodeURIComponent(s3Record.object.key.replace(/\+/g, ' '));

    const assetId = key.split('/')[1];
    if (!assetId) {
      console.error('Invalid message body, missing assetId', record.body);
      continue;
    }

    try {
      console.log(`Processing asset ${assetId}`);

      // 1. Mark asset as 'processing'
      await db.none('UPDATE assets SET status = $1 WHERE id = $2', ['processing', assetId]);
      // 2. Get all presets
      const presets = await db.manyOrNone<Preset>('SELECT * FROM presets');

      // 3. Download original image from s3
      const getObjectCmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
      const originalObject = await s3.send(getObjectCmd);
      if (!originalObject.Body) {
        throw new Error('Original S3 object has no body');
      }
      const originalBuffer = await streamToBuffer(originalObject.Body as NodeJS.ReadableStream);

      // 4. Generate variants for each preset
      const variantPromise = presets.map(async preset => {
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
      });

      const generatedVariants = await Promise.all(variantPromise);

      // 5. Insert all variants and update asset status
      await db.tx(async t => {
        await t.batch([
          ...generatedVariants.map(variant =>
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
          t.none('UPDATE assets SET status = $1 WHERE id = $2', ['processed', assetId]),
        ]);
      });

      console.log(
        `Successfully processed asset ${assetId} with ${generatedVariants.length} variants`
      );
    } catch (error) {
      console.error(`Error processing asset ${assetId}: ${(error as Error).message}`);
      await db.none('UPDATE assets SET status = $1, processing_error = $2 WHERE id = $3', [
        'failed',
        (error as Error).message,
        assetId,
      ]);
      // Re-throw the error to allow SQS / DLQ semantics
      throw error;
    }
  }
};
