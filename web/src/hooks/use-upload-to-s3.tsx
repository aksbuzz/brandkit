import type { PresignedUpload } from '../types/asset';

const S3_ERROR_MESSAGES: Record<string, string> = {
  EntityTooLarge: 'The file is larger than the allowed size',
  EntityTooSmall: 'The file is empty',
  AccessDenied: 'The upload link has expired or does not allow this file',
};

async function describeFailure(response: Response): Promise<string> {
  const body = await response.text().catch(() => '');
  const code = /<Code>([^<]+)<\/Code>/.exec(body)?.[1];
  return (code && S3_ERROR_MESSAGES[code]) || `Failed to upload file to S3 (${response.status})`;
}

export const useUploadFileToS3 = () => {
  async function upload({ upload, file }: { upload: PresignedUpload; file: File }) {
    const form = new FormData();
    Object.entries(upload.fields).forEach(([name, value]) => form.append(name, value));
    // S3 requires the file to be the last field of the form
    form.append('file', file);

    // No Content-Type header: the browser sets the multipart boundary itself
    const response = await fetch(upload.url, { method: 'POST', body: form });

    if (!response.ok) throw new Error(await describeFailure(response));

    return response;
  }

  return upload;
};
