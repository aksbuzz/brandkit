import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import type { MutationConfig } from '../../../lib/react-query';
import type { CreatePresetInput, Preset } from '../../../types/preset';
import { getPresetsQueryOptions } from './get-presets';

export const createPreset = ({ data }: { data: CreatePresetInput }): Promise<Preset> => {
  return api.post(`/presets`, data);
};

type UseMutationConfig = {
  mutationConfig?: MutationConfig<typeof createPreset>;
};

export const useCreatePreset = ({ mutationConfig }: UseMutationConfig = {}) => {
  const queryClient = useQueryClient();

  const { onSuccess, ...restConfig } = mutationConfig || {};

  return useMutation({
    onSuccess: (...args) => {
      queryClient.refetchQueries({ queryKey: getPresetsQueryOptions().queryKey });
      onSuccess?.(...args);
    },
    ...restConfig,
    mutationFn: createPreset,
  });
};
