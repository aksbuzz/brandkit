import { infiniteQueryOptions, useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import type { AssetPage } from '../../../types/asset';
import { isInFlight } from '../../../utils/asset-status';

export const ASSETS_PAGE_SIZE = 48;
const POLL_INTERVAL_MS = 3000;

export const getAssets = ({ offset }: { offset: number }): Promise<AssetPage> => {
  return api.get(`/assets`, { params: { limit: ASSETS_PAGE_SIZE, offset } });
};

export function getAssetsQueryOptions() {
  return infiniteQueryOptions({
    queryKey: ['assets'],
    queryFn: ({ pageParam }) => getAssets({ offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: lastPage => {
      const next = lastPage.offset + lastPage.items.length;
      return next < lastPage.total ? next : undefined;
    },
    // Keep refreshing while freshly uploaded assets are still being processed
    refetchInterval: query =>
      query.state.data?.pages.some(page => page.items.some(isInFlight)) ? POLL_INTERVAL_MS : false,
  });
}

export const useAssets = () => {
  return useInfiniteQuery(getAssetsQueryOptions());
};
