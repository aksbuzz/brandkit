import type { AssetStatus } from '../types/asset';

export const assetStatusColor: Record<AssetStatus, string> = {
  pending: 'bg-gray-100 text-gray-800',
  processing: 'bg-yellow-100 text-yellow-800',
  processed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  deleting: 'bg-orange-100 text-orange-800',
};

// A pending asset whose upload never happened stays pending forever, so only treat recent
// ones as "still in flight" when deciding whether to keep polling.
const IN_FLIGHT_WINDOW_MS = 30 * 60 * 1000;

export const isInFlight = (asset: { status: AssetStatus; created_at: string }) =>
  (asset.status === 'pending' || asset.status === 'processing') &&
  Date.now() - new Date(asset.created_at).getTime() < IN_FLIGHT_WINDOW_MS;
