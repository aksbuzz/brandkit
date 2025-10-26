import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import type { MutationConfig } from '../../../lib/react-query';
import { getPresetsQueryOptions } from './get-presets';

export const deletePreset = ({ id }: { id: string }): Promise<void> => {
  return api.delete(`/presets/${id}`);
};

type UseMutationConfig = {
  mutationConfig?: MutationConfig<typeof deletePreset>;
};

export const useDeletePreset = ({ mutationConfig }: UseMutationConfig = {}) => {
  const queryClient = useQueryClient();

  const { onSuccess, ...restConfig } = mutationConfig || {};

  return useMutation({
    onSuccess: (...args) => {
      queryClient.refetchQueries({ queryKey: getPresetsQueryOptions().queryKey });
      onSuccess?.(...args);
    },
    ...restConfig,
    mutationFn: deletePreset,
  });
};
