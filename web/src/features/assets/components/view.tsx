import { Anchor } from '../../../components/ui/Anchor';
import { Button } from '../../../components/ui/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/Dialog';
import { useCopyToClipboard } from '../../../hooks';
import type { TransformationStatus } from '../../../types/transformation';
import { cn } from '../../../utils/cn';
import { formatFileSize } from '../../../utils/formatFileSize';
import type { Asset } from '../../../types/asset';

type ViewAssetDialogProps = {
  assetId: string;
  onClose: () => void;
};

export const ViewAssetDialog = ({ assetId, onClose }: ViewAssetDialogProps) => {
  const [_, copyToClipboard] = useCopyToClipboard();
  const assetData: Asset = {};

  function renderOriginalAsset() {
    return (
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Original Asset</h3>
        <div className="bg-gray-50 rounded-lg p-4">
          {assetData.url && (
            <img
              src={assetData.url}
              alt={assetData.name}
              className="w-full h-auto rounded-lg mb-4"
            />
          )}

          <div className="space-y-2 text-sm text-gray-600">
            {assetData.width && assetData.height && (
              <div>
                Dimensions: {assetData.width} × {assetData.height}
              </div>
            )}
            <div>Size: {formatFileSize(assetData.size)}</div>
            <div>Type: {assetData.contentType}</div>
          </div>

          {assetData.url && (
            <Button onClick={() => copyToClipboard(assetData.url!)} className="mt-3">
              Copy URL
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Dialog open={!!assetId} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{'assetData.name'}</DialogTitle>
        </DialogHeader>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {renderOriginalAsset()}

            {/* Transformations */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Transformations</h3>
              <div className="space-y-4">
                {assetData?.transformations?.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No transformation presets available.</p>
                    <p className="text-sm mt-1">Create presets to generate transformed versions.</p>
                  </div>
                ) : (
                  assetData?.transformations?.map(transformation => (
                    <div key={transformation._id} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-gray-900">{transformation.preset?.name}</h4>
                        <span
                          className={cn(
                            'px-2 py-1 text-xs rounded-full',
                            transformationStatusColor[transformation.status]
                          )}
                        >
                          {transformation.status}
                        </span>
                      </div>

                      {transformation.preset && (
                        <div className="text-sm text-gray-600 mb-3">
                          {transformation.preset.width} × {transformation.preset.height} •{' '}
                          {transformation.preset.format.toUpperCase()}
                          {transformation.preset.quality &&
                            ` • ${transformation.preset.quality}% quality`}
                        </div>
                      )}

                      {transformation.status === 'completed' && transformation.url && (
                        <div className="flex space-x-2">
                          <Anchor
                            href={transformation.url}
                            className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
                          >
                            View
                          </Anchor>
                          <Button onClick={() => copyToClipboard(transformation.url!)}>
                            Copy URL
                          </Button>
                        </div>
                      )}

                      {transformation.status === 'failed' && transformation.errorMessage && (
                        <div className="text-sm text-red-600 mt-2">
                          Error: {transformation.errorMessage}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const transformationStatusColor: Record<TransformationStatus, string> = {
  PROCESSING: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
};
