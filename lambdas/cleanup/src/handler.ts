import { DeleteObjectsCommand, S3Client } from '@aws-sdk/client-s3';
import { SQSBatchItemFailure, SQSBatchResponse, SQSEvent } from 'aws-lambda';
import { db } from './db';

const s3 = new S3Client({});
const BUCKET = process.env.BUCKET!;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DELETE_OBJECTS_LIMIT = 1000; // S3 accepts at most 1000 keys per DeleteObjects call

async function deleteKeys(keys: string[]): Promise<void> {
  for (let i = 0; i < keys.length; i += DELETE_OBJECTS_LIMIT) {
    const chunk = keys.slice(i, i + DELETE_OBJECTS_LIMIT);
    const result = await s3.send(
      new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: { Objects: chunk.map(Key => ({ Key })), Quiet: true },
      })
    );
    // DeleteObjects returns 200 even when individual keys fail, so check explicitly
    if (result.Errors && result.Errors.length > 0) {
      const first = result.Errors[0];
      throw new Error(`Failed to delete ${result.Errors.length} object(s), first: ${first.Key} (${first.Code})`);
    }
  }
}

async function deleteAsset(assetId: string): Promise<void> {
  const asset = await db.oneOrNone<{ original_s3_key: string | null }>(
    'SELECT original_s3_key FROM assets WHERE id = $1',
    assetId
  );
  if (!asset) {
    console.log(`Asset ${assetId} not found, skipping`);
    return;
  }

  // Assets that failed or never finished processing have no variants but still own an original
  const variants = await db.manyOrNone<{ s3_key: string }>(
    'SELECT s3_key FROM variants WHERE asset_id = $1',
    assetId
  );

  const keys = [...(asset.original_s3_key ? [asset.original_s3_key] : []), ...variants.map(v => v.s3_key)];
  await deleteKeys(keys);
  console.log(`Deleted ${keys.length} object(s) for asset ${assetId}`);

  // variants are removed by ON DELETE CASCADE
  await db.none('DELETE FROM assets WHERE id = $1', assetId);
  console.log(`Deleted asset ${assetId} from DB`);
}

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const batchItemFailures: SQSBatchItemFailure[] = [];

  for (const record of event.Records) {
    try {
      const { assetId } = JSON.parse(record.body);
      if (typeof assetId !== 'string' || !UUID_PATTERN.test(assetId)) {
        console.error('Invalid message body, missing or malformed assetId', record.body);
        continue; // retrying cannot fix a malformed message
      }
      await deleteAsset(assetId);
    } catch (error) {
      console.error(`Error handling record ${record.messageId}: ${(error as Error).message}`);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
