import { queryOptions, useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import type { QueryConfig } from '../../../lib/react-query';
import type { Asset } from '../../../types/asset';

export const getAssets = (): Promise<Asset[]> => {
  return api.get(`/assets`);
};

export function getAssetsQueryOptions() {
  return queryOptions({ queryKey: ['assets'], queryFn: getAssets });
}

type UseAssetsOptions = {
  queryConfig?: QueryConfig<typeof getAssetsQueryOptions>;
};

export const useAssets = ({ queryConfig }: UseAssetsOptions = {}) => {
  return useQuery({ ...getAssetsQueryOptions(), ...queryConfig });
};
