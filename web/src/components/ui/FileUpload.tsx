import { useRef, useState, type ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { toast } from 'sonner';

interface FileUploadProps {
  onUpload: (files: File[]) => Promise<void>;
  accept?: string;
  multiple?: boolean;
  children: ReactNode;
  className?: string;
}

export function FileUpload({
  onUpload,
  accept,
  multiple = true,
  children,
  className,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelection = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      await onUpload(Array.from(files));
    } catch (error) {
      console.error('Upload process failed:', error);
      toast.error('Upload process failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (isUploading) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (isUploading) return;
    setIsDragging(false);
    handleFileSelection(e.dataTransfer.files);
  };

  const openFileDialog = () => {
    if (isUploading) return;
    fileInputRef.current?.click();
  };

  return (
    <div
      className={cn(
        'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
        isUploading && 'cursor-not-allowed opacity-60',
        isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400',
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={openFileDialog}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={e => handleFileSelection(e.target.files)}
        className="hidden"
        disabled={isUploading}
      />

      {isUploading ? (
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Uploading...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center cursor-pointer">{children}</div>
      )}
    </div>
  );
}
