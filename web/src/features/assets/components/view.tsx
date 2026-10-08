import { Anchor } from '../../../components/ui/Anchor';
import { Button } from '../../../components/ui/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/Dialog';
import { Spinner } from '../../../components/ui/Spinner';
import { useCopyToClipboard } from '../../../hooks';
import type { Asset, Variant } from '../../../types/asset';
import { assetStatusColor } from '../../../utils/asset-status';
import { cn } from '../../../utils/cn';
import { formatFileSize } from '../../../utils/formatFileSize';
import { useAsset } from '../api/get-asset';

type ViewAssetDialogProps = {
  assetId: string;
  onClose: () => void;
};

export const ViewAssetDialog = ({ assetId, onClose }: ViewAssetDialogProps) => {
  const [, copyToClipboard] = useCopyToClipboard();
  const assetQuery = useAsset({ assetId });

  function renderOriginalAsset(asset: Asset) {
    return (
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Original Asset</h3>
        <div className="bg-gray-50 rounded-lg p-4">
          {asset.url && (
            <img
              src={asset.url}
              alt={asset.original_filename}
              className="w-full h-auto rounded-lg mb-4"
            />
          )}

          <div className="flex flex-col space-y-2 text-sm text-gray-600">
            <span
              className={cn(
                'px-2 self-end py-1 text-xs rounded-full capitalize',
                assetStatusColor[asset.status]
              )}
            >
              {asset.status}
            </span>
            <div>Size: {asset.size_bytes != null ? formatFileSize(asset.size_bytes) : 'Unknown'}</div>
            <div>Type: {asset.content_type}</div>
          </div>

          {asset.status === 'failed' && asset.processing_error && (
            <div className="text-sm text-red-600 mt-2">Error: {asset.processing_error}</div>
          )}

          {asset.original_s3_key && (
            <Button onClick={() => copyToClipboard(asset.url!)} className="mt-3">
              Copy URL
            </Button>
          )}
        </div>
      </div>
    );
  }

  function renderVariants(variants: Variant[]) {
    if (variants.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <p>No transformation presets available.</p>
          <p className="text-sm mt-1">Create presets to generate transformed versions.</p>
        </div>
      );
    }

    return variants?.map(variant => (
      <div key={variant.id} className="bg-gray-50 rounded-lg p-4">
        <div className="flex justify-between items-start mb-2">
          <h4 className="font-medium text-gray-900">{variant.name}</h4>
        </div>

        <div className="text-sm text-gray-600 mb-3">
          {variant.width} × {variant.height} • {variant.format!.toUpperCase()}
          {variant.quality && ` • ${variant.quality}% quality`}
        </div>

        {variant.url && (
          <div className="flex space-x-2">
            <Anchor
              href={variant.url}
              className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              View
            </Anchor>
            <Button onClick={() => copyToClipboard(variant.url!)}>Copy URL</Button>
          </div>
        )}
      </div>
    ));
  }

  return (
    <Dialog open={!!assetId} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        {!assetQuery.isLoading && assetQuery.data && (
          <DialogHeader>
            <DialogTitle>{assetQuery.data.original_filename || 'Untitled Asset'}</DialogTitle>
          </DialogHeader>
        )}

        <div className="p-6">
          {assetQuery.isLoading && (
            <div className="flex items-center justify-center">
              <Spinner size="lg" />
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {!assetQuery.isLoading && assetQuery.data && renderOriginalAsset(assetQuery.data)}

            {!assetQuery.isLoading && assetQuery.data && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Variants</h3>
                <div className="space-y-4">{renderVariants(assetQuery.data.variants)}</div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
