import { queryOptions, useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import type { QueryConfig } from '../../../lib/react-query';
import type { Asset, Variant } from '../../../types/asset';

export const getAsset = (assetId: string): Promise<Asset & {variants: Variant[]}> => {
  return api.get(`/assets/${assetId}`);
};

export function getAssetQueryOptions(assetId: string) {
  return queryOptions({ queryKey: ['asset', { assetId }], queryFn: () => getAsset(assetId) });
}

type UseAssetOptions = {
  assetId: string;
  queryConfig?: QueryConfig<typeof getAssetQueryOptions>;
};

export const useAsset = ({ assetId, queryConfig }: UseAssetOptions) => {
  return useQuery({ ...getAssetQueryOptions(assetId), ...queryConfig });
};
