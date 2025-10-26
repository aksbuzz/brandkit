import { queryOptions, useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import type { QueryConfig } from '../../../lib/react-query';
import type { Preset } from '../../../types/preset';

export const getPresets = (): Promise<Preset[]> => {
  return api.get(`/presets`);
};

export function getPresetsQueryOptions() {
  return queryOptions({ queryKey: ['presets'], queryFn: getPresets });
}

type UsePresetsOptions = {
  queryConfig?: QueryConfig<typeof getPresetsQueryOptions>;
};

export const usePresets = ({ queryConfig }: UsePresetsOptions = {}) => {
  return useQuery({ ...getPresetsQueryOptions(), ...queryConfig });
};
