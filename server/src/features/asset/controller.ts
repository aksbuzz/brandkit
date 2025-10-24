import { NextFunction, Request, Response } from 'express';
import { db } from '../../config/database';
import { getUploadUrl } from '../../services/s3.service';
import { sendDeleteMessage } from '../../services/sqs.service';
import { CreateAssetInput } from './schema';

export const createAssetHandler = async (
  req: Request<{}, {}, CreateAssetInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { filename, contentType } = req.body;

    const result = await db.tx(async t => {
      const newAsset = await t.one<{ id: string }>(
        'INSERT INTO assets (original_filename, content_type) \
        VALUES ($1, $2) \
        RETURNING id',
        [filename, contentType]
      );

      const assetId = newAsset.id;
      const s3Key = `originals/${assetId}/${filename}`;

      await t.none('UPDATE assets SET original_s3_key = $1 WHERE id = $2', [s3Key, assetId]);

      const signedUrl = await getUploadUrl(s3Key, contentType);
      return { assetId, signedUrl };
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const getAssetHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { assetId } = req.params;
    const asset = await db.one('SELECT * FROM assets WHERE id = $1', assetId);
    const variants = await db.any('SELECT * FROM variants WHERE asset_id = $1', assetId);
    res.status(200).json({ ...asset, variants });
  } catch (error) {
    next(error);
  }
};

export const deleteAssetHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { assetId } = req.params;
    await db.none("UPDATE assets SET status = 'deleting' WHERE id = $1", assetId);
    await sendDeleteMessage(assetId);
    res.status(202).json({ message: 'Deletion scheduled' });
  } catch (error) {
    next(error);
  }
};
