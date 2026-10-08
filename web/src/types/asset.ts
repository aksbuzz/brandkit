export const ASSET_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  PROCESSED: 'processed',
  FAILED: 'failed',
  DELETING: 'deleting',
} as const;

export type AssetStatus = (typeof ASSET_STATUS)[keyof typeof ASSET_STATUS];

/** An asset as returned by the list endpoint. */
export interface AssetSummary {
  id: string;
  original_filename: string;
  content_type: string;
  size_bytes: number | null;
  status: AssetStatus;
  created_at: string;
  updated_at: string;
  /** CDN URL of the original file */
  url: string | null;
  /** CDN URL of the smallest generated variant, once processing has produced one */
  thumbnail_url: string | null;
}

export type AssetPage = {
  items: AssetSummary[];
  total: number;
  limit: number;
  offset: number;
};

/** An asset as returned by the detail endpoint. */
export interface Asset extends Omit<AssetSummary, 'thumbnail_url'> {
  original_s3_key: string | null;
  processing_error: string | null;
}

export type CreateAssetInput = {
  filename: string;
  fileSizeBytes: number;
  contentType: string;
};

/** Presigned S3 POST: send `fields` as form fields, then the file as the last field. */
export type PresignedUpload = {
  url: string;
  fields: Record<string, string>;
};

export type CreateAssetResponse = {
  assetId: string;
  upload: PresignedUpload;
};

export interface Variant {
  id: string;
  asset_id: string;
  preset_id: string;
  s3_key: string;
  width: number;
  height: number;
  content_type: string;
  size_bytes: number;
  created_at: string;
  url: string;

  name?: string;
  format?: string;
  quality?: number;
}
