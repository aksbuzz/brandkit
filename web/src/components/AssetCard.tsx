import { CircleX, Image } from 'lucide-react';
import type { MouseEvent } from 'react';
import type { Asset } from '../types/asset';
import { formatFileSize } from '../utils/formatFileSize';
import { IconButton } from './ui/IconButton';

interface AssetCardProps {
  asset: Asset;
  onClick: () => void;
  onDelete?: (id: string) => Promise<void>;
}

export function AssetCard({ asset, onClick, onDelete }: AssetCardProps) {
  const handleDelete = async (e: MouseEvent) => {
    e.stopPropagation();

    if (!confirm(`Are you sure you want to delete "${asset.name}"?`)) {
      return;
    }

    try {
      await onDelete?.(asset._id);
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  return (
    <div
      className="group relative bg-gray-50 rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <div className="aspect-square bg-gray-100 flex items-center justify-center">
        {asset.url ? (
          <img src={asset.url} alt={asset.name} className="w-full h-full object-cover" />
        ) : (
          <Image size={32} className="text-gray-400" />
        )}
      </div>

      <div className="p-3">
        <h4 className="text-sm font-medium text-gray-900 truncate mb-1">{asset.name}</h4>
        <div className="text-xs text-gray-500 space-y-1">
          {asset.width && asset.height && (
            <div>
              {asset.width} × {asset.height}
            </div>
          )}
          <div>{formatFileSize(asset.size)}</div>
        </div>
      </div>

      <IconButton
        variant="danger"
        size="sm"
        onClick={handleDelete}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <CircleX />
      </IconButton>
    </div>
  );
}
