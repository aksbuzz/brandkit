import { SQSEvent } from 'aws-lambda';
import { db } from './db';
import { DeleteObjectsCommand, S3Client } from '@aws-sdk/client-s3';

const s3 = new S3Client({});
const BUCKET = process.env.BUCKET!;

export const handler = async (event: SQSEvent): Promise<void> => {
  for (const record of event.Records) {
    const { assetId } = JSON.parse(record.body);
    if (!assetId) {
      console.error('Invalid message body, missing assetId', record.body);
      continue;
    }

    try {
      console.log(`Deleting asset ${assetId}`);

      const assetRes = await db.oneOrNone<{ original_s3_key: string }>(
        'SELECT original_s3_key FROM assets WHERE id = $1',
        [assetId]
      );
      if (!assetRes) {
        console.log(`Asset ${assetId} not found, skipping`);
        continue;
      }

      const variantRes = await db.manyOrNone<{ s3_key: string }>(
        'SELECT s3_key FROM variants WHERE asset_id = $1',
        [assetId]
      );
      if (!variantRes || variantRes.length === 0) {
        console.log(`Asset ${assetId} has no variants, skipping`);
        continue;
      }

      const keysToDelete = [
        { Key: assetRes.original_s3_key },
        ...variantRes.map(({ s3_key }) => ({ Key: s3_key })),
      ];

      await s3.send(
        new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: keysToDelete } })
      );
      console.log(`Deleted asset ${assetId}`);

      await db.none('DELETE FROM assets WHERE id = $1', [assetId]);
      console.log(`Deleted asset ${assetId} from DB`);
    } catch (error) {
      console.error(`Error deleting asset ${assetId}`, error);
      // rethrow to let SQS / DLQ semantics apply
      throw error;
    }
  }
};
