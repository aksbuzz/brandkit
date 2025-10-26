import { ImageUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/Button';
import { FileUpload } from '../../../components/ui/FileUpload';
import { useUploadFileToS3 } from '../../../hooks';
import { useCreateAsset } from '../api/create-asset';

export const UploadAssets = () => {
  const createAssetMutation = useCreateAsset();
  const uploadToS3 = useUploadFileToS3();

  async function handleUpload(files: File[]) {
    const uploadPromises = files.map(async file => {
      try {
        const { assetId, signedUrl } = await createAssetMutation.mutateAsync({
          data: {
            fileName: file.name,
            contentType: file.type,
            fileSizeBytes: file.size,
          },
        });

        await uploadToS3({ signedUrl, file });

        return assetId;
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        toast.error(`Failed to upload ${file.name}`);
        throw error;
      }
    });

    const results = await Promise.allSettled(uploadPromises);

    const successfulUploads = results.filter(r => r.status === 'fulfilled').length;
    if (successfulUploads > 0) {
      toast.success(
        `${successfulUploads} file${successfulUploads > 1 ? 's' : ''} uploaded successfully`
      );
    }
  }

  return (
    <FileUpload onUpload={handleUpload} accept="image/*" multiple>
      <ImageUp size={48} className="mb-4 text-gray-400" />
      <p className="text-lg font-medium text-gray-900 mb-2">Drop images here or click to upload</p>
      <p className="text-sm text-gray-500 mb-4">Supports JPEG, PNG files up to 10MB</p>
      <Button variant="primary" className="pointer-events-none">
        Choose Files
      </Button>
    </FileUpload>
  );
};
