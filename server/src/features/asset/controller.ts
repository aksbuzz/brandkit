import { NextFunction, Request, Response } from 'express';
import { config } from '../../config';
import { db } from '../../config/database';
import { getUploadUrl } from '../../services/s3.service';
import { CreateAssetInput } from './schema';

const buildCdnUrl = (key: string | null): string | null =>
  key ? `https://${config.aws.cloudfront.domainName}/${key}` : null;

export const createAssetHandler = async (
  req: Request<{}, {}, CreateAssetInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { filename, fileSizeBytes, contentType } = req.body;

    // Generate the S3 key upfront so we can do a single INSERT with no follow-up UPDATE
    const assetId = crypto.randomUUID();
    const s3Key = `originals/${assetId}/${filename}`;

    await db.none(
      'INSERT INTO assets (id, original_filename, content_type, size_bytes, original_s3_key) \
      VALUES ($1, $2, $3, $4, $5)',
      [assetId, filename, contentType, fileSizeBytes, s3Key]
    );

    const signedUrl = await getUploadUrl(s3Key, contentType);

    res.status(201).json({ assetId, signedUrl });
  } catch (error) {
    next(error);
  }
};

export const getAssetsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 100);
    const offset = parseInt((req.query.offset as string) || '0', 10);

    const assets = await db.any(
      'SELECT * FROM assets ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    const assetsWithUrls = assets.map(asset => ({
      ...asset,
      url: buildCdnUrl(asset.original_s3_key),
    }));

    res.status(200).json(assetsWithUrls);
  } catch (error) {
    next(error);
  }
};

export const getAssetHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { assetId } = req.params;
    // db.one throws QueryResultError when not found — error-handler maps that to 404
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

    const assetWithUrl = { ...asset, url: buildCdnUrl(asset.original_s3_key) };
    const variantsWithUrls = variants.map(variant => ({
      ...variant,
      url: buildCdnUrl(variant.s3_key),
    }));

    res.status(200).json({ ...assetWithUrl, variants: variantsWithUrls });
  } catch (error) {
    next(error);
  }
};
