import { ListAssets } from '../../features/assets/components/list';
import { UploadAssets } from '../../features/assets/components/upload';
import { useDocumentTitle } from '../../hooks';

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
