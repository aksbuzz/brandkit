import type { QueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { useCreatePreset } from '../../features/presets/api/create-preset';
import { getPresetsQueryOptions, usePresets } from '../../features/presets/api/get-presets';
import { CreatePreset } from '../../features/presets/components/create';
import { ListPresets } from '../../features/presets/components/list';
import { useDocumentTitle } from '../../hooks';
import type { CreatePresetInput } from '../../types/preset';

// eslint-disable-next-line react-refresh/only-export-components
export const clientLoader = (queryClient: QueryClient) => () => async () => {
  const query = getPresetsQueryOptions();
  return queryClient.getQueryData(query.queryKey) ?? (await queryClient.fetchQuery(query));
};

const commonPresets: CreatePresetInput[] = [
  { name: 'Twitter Post', width: 1024, height: 512, format: 'webp' as const },
  { name: 'Instagram Square', width: 1080, height: 1080, format: 'webp' as const },
  { name: 'Facebook Cover', width: 1200, height: 630, format: 'webp' as const },
  { name: 'LinkedIn Banner', width: 1584, height: 396, format: 'webp' as const },
  { name: 'Web Thumbnail', width: 400, height: 300, format: 'webp' as const },
];

const PresetsRoutes = () => {
  useDocumentTitle('BrandKit - Presets');

  const presetsQuery = usePresets();
  const createPresetMutation = useCreatePreset();

  const [showForm, setShowForm] = useState<boolean>(false);

  async function addCommonPreset(preset: CreatePresetInput) {
    await createPresetMutation.mutateAsync({ data: preset });
    toast.success('Preset created successfully');
  }

  if (presetsQuery.isLoading) {
    return (
      <div className="flex h-48 w-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const presets = presetsQuery.data;

  if (!presets) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Transformation Presets</h3>
          <Button
            onClick={() => setShowForm(prev => !prev)}
            variant={showForm ? 'danger' : 'primary'}
          >
            {showForm ? 'Cancel' : 'Create Preset'}
          </Button>
        </div>

        <p className="text-gray-600 mb-4">
          Create transformation presets to automatically generate different versions of your assets.
        </p>

        {presets.length === 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Quick Add Common Presets:</h4>
            <div className="flex flex-wrap gap-2">
              {commonPresets.map(preset => (
                <Button
                  variant="secondary"
                  size="sm"
                  key={preset.name}
                  onClick={() => addCommonPreset(preset)}
                >
                  {preset.name} ({preset.width}×{preset.height})
                </Button>
              ))}
            </div>
          </div>
        )}

        {showForm && <CreatePreset />}
      </div>

      <ListPresets presets={presets} />
    </div>
  );
};

export default PresetsRoutes;
