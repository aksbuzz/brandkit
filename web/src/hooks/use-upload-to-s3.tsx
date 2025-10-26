export const useUploadFileToS3 = () => {
  async function upload({ signedUrl, file }: { signedUrl: string; file: File }) {
    const response = await fetch(signedUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });

    if (!response.ok) throw new Error('Failed to upload file to S3');

    return response;
  }

  return upload;
};
