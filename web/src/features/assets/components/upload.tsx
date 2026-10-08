import { useQueryClient } from '@tanstack/react-query';
import { ImageUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/Button';
import { FileUpload } from '../../../components/ui/FileUpload';
import { useUploadFileToS3 } from '../../../hooks';
import { formatFileSize } from '../../../utils/formatFileSize';
import { useCreateAsset } from '../api/create-asset';
import { getAssetsQueryOptions } from '../api/get-assets';

// Keep in sync with the server (ALLOWED_CONTENT_TYPES and MAX_UPLOAD_BYTES); the server and S3 enforce them.
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const MAX_UPLOAD_MB = Number(import.meta.env.VITE_MAX_UPLOAD_MB) || 10;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const MAX_CONCURRENT_UPLOADS = 3;

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return `${file.name}: unsupported file type`;
  if (file.size === 0) return `${file.name}: file is empty`;
  if (file.size > MAX_UPLOAD_BYTES) {
    return `${file.name}: ${formatFileSize(file.size)} exceeds the ${MAX_UPLOAD_MB}MB limit`;
  }
  return null;
}

export const UploadAssets = () => {
  const queryClient = useQueryClient();

  const createAssetMutation = useCreateAsset();
  const uploadToS3 = useUploadFileToS3();

  async function uploadOne(file: File): Promise<boolean> {
    try {
      const { upload } = await createAssetMutation.mutateAsync({
        data: {
          filename: file.name,
          contentType: file.type,
          fileSizeBytes: file.size,
        },
      });

      await uploadToS3({ upload, file });
      return true;
    } catch (error) {
      console.error(`Failed to upload ${file.name}:`, error);
      toast.error(`Failed to upload ${file.name}`);
      return false;
    }
  }

  async function handleUpload(files: File[]) {
    const accepted: File[] = [];
    for (const file of files) {
      const problem = validateFile(file);
      if (problem) toast.error(problem);
      else accepted.push(file);
    }

    // Small worker pool so dropping many files does not open dozens of simultaneous uploads
    let succeeded = 0;
    let next = 0;
    const workers = Array.from({ length: Math.min(MAX_CONCURRENT_UPLOADS, accepted.length) }, async () => {
      while (next < accepted.length) {
        const file = accepted[next++];
        if (await uploadOne(file)) succeeded++;
      }
    });
    await Promise.all(workers);

    if (succeeded > 0) {
      toast.success(`${succeeded} file${succeeded > 1 ? 's' : ''} uploaded successfully`);
      await queryClient.refetchQueries({ queryKey: getAssetsQueryOptions().queryKey });
    }
  }

  return (
    <FileUpload onUpload={handleUpload} accept={ALLOWED_TYPES.join(',')} multiple>
      <ImageUp size={48} className="mb-4 text-gray-400" />
      <p className="text-lg font-medium text-gray-900 mb-2">Drop images here or click to upload</p>
      <p className="text-sm text-gray-500 mb-4">
        Supports JPEG, PNG, WebP, GIF and AVIF files up to {MAX_UPLOAD_MB}MB
      </p>
      <Button variant="primary" className="pointer-events-none">
        Choose Files
      </Button>
    </FileUpload>
  );
};
