import { NextFunction, Request, Response } from 'express';
import { db } from '../../config/database';
import { getDownloadUrl, getUploadUrl } from '../../services/s3.service';
import { CreateAssetInput } from './schema';
// import { sendDeleteMessage } from '../../services/sqs.service';

export const createAssetHandler = async (
  req: Request<{}, {}, CreateAssetInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { filename, fileSizeBytes, contentType } = req.body;

    const result = await db.tx(async t => {
      const newAsset = await t.one<{ id: string }>(
        'INSERT INTO assets (original_filename, content_type, size_bytes) \
        VALUES ($1, $2, $3) \
        RETURNING id',
        [filename, contentType, fileSizeBytes]
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

export const getAssetsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const assets = await db.any('SELECT * FROM assets');

    const assetsWithUrls = await Promise.all(
      assets.map(async asset => ({
        ...asset,
        url: await getDownloadUrl(asset.original_s3_key),
      }))
    );

    res.status(200).json(assetsWithUrls);
  } catch (error) {
    next(error);
  }
};

export const getAssetHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { assetId } = req.params;
    const asset = await db.one('SELECT * FROM assets WHERE id = $1', assetId);
    const variants = await db.any(
      `SELECT 
        v.id, v.s3_key, v.width, v.height, v.content_type, v.size_bytes, v.created_at, 
        p.name, p.format, p.quality 
      FROM variants v 
      LEFT JOIN presets p ON v.preset_id = p.id 
      WHERE v.asset_id = $1`,
      assetId
    );

    const assetWithUrl = {
      ...asset,
      url: await getDownloadUrl(asset.original_s3_key),
    };

    const variantsWithUrls = await Promise.all(
      variants.map(async variant => ({
        ...variant,
        url: await getDownloadUrl(variant.s3_key),
      }))
    );

    res.status(200).json({ ...assetWithUrl, variants: variantsWithUrls });
  } catch (error) {
    next(error);
  }
};

// export const deleteAssetHandler = async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const { assetId } = req.params;
//     await db.none("UPDATE assets SET status = 'deleting' WHERE id = $1", assetId);
//     await sendDeleteMessage(assetId);
//     res.status(202).json({ message: 'Deletion scheduled' });
//   } catch (error) {
//     next(error);
//   }
// };
