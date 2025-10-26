import { Image } from 'lucide-react';
import { useState } from 'react';
import { AssetCard } from '../../../components/AssetCard';
import { ViewAssetDialog } from './view';
import { useAssets } from '../api/get-assets';
import { Spinner } from '../../../components/ui/Spinner';

export const ListAssets = () => {
  const assetsQuery = useAssets();
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  
  if (assetsQuery.isLoading) {
    return (
      <div className="flex h-48 w-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const assets = assetsQuery.data;

  if (!assets) {
    return null;
  }

  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center bg-white rounded-lg shadow-sm border border-gray-200 p-12">
        <Image size={48} className="mb-4 text-gray-400" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No assets yet</h3>
        <p className="text-gray-500">Upload your first brand asset to get started</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Asset Gallery</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {assets.map(asset => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onClick={() => setSelectedAssetId(asset.id)}
            />
          ))}
        </div>
      </div>

      {selectedAssetId && (
        <ViewAssetDialog assetId={selectedAssetId} onClose={() => setSelectedAssetId(null)} />
      )}
    </>
  );
};
