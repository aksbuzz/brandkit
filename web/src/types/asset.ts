import type { TransformationStatus } from "./transformation";

export interface Asset {
  id: string;
  contentType: string;
  name: string;
  originalFileId: string;
  size: number;
  width?: number;
  height?: number;
}

export interface TransformedAsset {
  id: string;
  assetId: string;
  presetId: string;
  status: TransformationStatus;
  transformedFileId: string;
}