import { Image } from 'lucide-react';
import type { AssetSummary } from '../types/asset';
import { assetStatusColor } from '../utils/asset-status';
import { cn } from '../utils/cn';
import { formatFileSize } from '../utils/formatFileSize';

interface AssetCardProps {
  asset: AssetSummary;
  onClick: () => void;
  // onDelete?: (id: string) => Promise<void>;
}

export function AssetCard({ asset, onClick }: AssetCardProps) {
  // const handleDelete = async (e: MouseEvent) => {
  //   e.stopPropagation();

  //   if (!confirm(`Are you sure you want to delete this asset?`)) {
  //     return;
  //   }

  //   try {
  //     await onDelete?.(asset.id);
  //   } catch (error) {
  //     console.error('Delete error:', error);
  //   }
  // };

  // Prefer the generated thumbnail; the original is only a sensible fallback once processing has finished
  const imageUrl = asset.thumbnail_url ?? (asset.status === 'processed' ? asset.url : null);

  return (
    <div
      className="group relative bg-gray-50 rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <div className="aspect-square bg-gray-100 flex items-center justify-center">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={asset.original_filename}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <Image size={32} className="text-gray-400" />
        )}
      </div>

      <div className="p-3 flex flex-col">
        <span
          className={cn(
            'px-2 self-end py-1 text-xs rounded-full capitalize',
            assetStatusColor[asset.status]
          )}
        >
          {asset.status}
        </span>

        <h4 className="text-sm font-medium text-gray-900 truncate mb-1">
          {asset.original_filename}
        </h4>

        <div className="text-xs text-gray-500 space-y-1">
          <div className="uppercase">{asset.content_type.split('/')[1]}</div>
          {asset.size_bytes != null && <div>{formatFileSize(asset.size_bytes)}</div>}
        </div>
      </div>

      {/* <IconButton
        variant="danger"
        size="sm"
        onClick={handleDelete}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <CircleX />
      </IconButton> */}
    </div>
  );
}
