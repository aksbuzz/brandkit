import type { QueryClient } from '@tanstack/react-query';
import { ListAssets } from '../../features/assets/components/list';
import { UploadAssets } from '../../features/assets/components/upload';
import { useDocumentTitle } from '../../hooks';
import { getAssetsQueryOptions } from '../../features/assets/api/get-assets';

// eslint-disable-next-line react-refresh/only-export-components
export const clientLoader = (queryClient: QueryClient) => () => async () => {
  const query = getAssetsQueryOptions();
  return queryClient.getQueryData(query.queryKey) ?? (await queryClient.fetchInfiniteQuery(query));
};

const AssetsRoutes = () => {
  useDocumentTitle('BrandKit - Assets');

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Assets</h3>
        <UploadAssets />
      </div>
      <ListAssets />
    </div>
  );
};

export default AssetsRoutes;
