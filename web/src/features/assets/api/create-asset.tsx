import { useMutation } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import type { MutationConfig } from '../../../lib/react-query';
import type { CreateAssetInput, CreateAssetResponse } from '../../../types/asset';

export const createAsset = ({ data }: { data: CreateAssetInput }): Promise<CreateAssetResponse> => {
  return api.post(`/assets`, data);
};

type UseMutationConfig = {
  mutationConfig?: MutationConfig<typeof createAsset>;
};

export const useCreateAsset = ({ mutationConfig }: UseMutationConfig = {}) => {
  const { onSuccess, ...restConfig } = mutationConfig || {};

  return useMutation({
    onSuccess: (...args) => {
      console.log('Successfully received signed URL for asset upload');
      onSuccess?.(...args);
    },
    ...restConfig,
    mutationFn: createAsset,
  });
};
