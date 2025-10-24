import { ImageUp } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { FileUpload } from '../../../components/ui/FileUpload';

export const UploadAssets = () => {
  async function handleUpload(files: File[]) {
    console.log('Uploading files:', files);
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
