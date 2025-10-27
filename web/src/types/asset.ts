export const ASSET_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  PROCESSED: 'processed',
  FAILED: 'failed',
} as const;

export type AssetStatus = (typeof ASSET_STATUS)[keyof typeof ASSET_STATUS];

export interface Asset {
  id: string;
  original_s3_key: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  status: AssetStatus;
  processing_error: string | null;
  created_at: Date;
  updated_at: Date;
  url: string;
}

export type CreateAssetInput = {
  filename: string;
  fileSizeBytes: number;
  contentType: string;
};

export type CreateAssetResponse = {
  assetId: string;
  signedUrl: string;
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
  created_at: Date;
  url: string;

  name?: string;
  format?: string;
  quality?: number;
}
