import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { CreatePreset } from '../../features/presets/components/create';
import { ListPresets } from '../../features/presets/components/list';
import { useDocumentTitle } from '../../hooks';
import type { Preset } from '../../types/preset';

const commonPresets = [
  { name: 'Twitter Post', width: 1024, height: 512, format: 'webp' as const },
  { name: 'Instagram Square', width: 1080, height: 1080, format: 'webp' as const },
  { name: 'Facebook Cover', width: 1200, height: 630, format: 'webp' as const },
  { name: 'LinkedIn Banner', width: 1584, height: 396, format: 'webp' as const },
  { name: 'Web Thumbnail', width: 400, height: 300, format: 'webp' as const },
];

const PresetsRoutes = () => {
  useDocumentTitle('BrandKit - Presets');

  const presets: Preset[] = [
    {
      _id: '1',
      format: 'webp',
      height: 1080,
      width: 1080,
      name: 'Instagram',
      quality: 85,
      _creationTime: 0,
    },
  ];

  const [showForm, setShowForm] = useState<boolean>(false);

  async function addCommonPreset(preset: Partial<Preset>) {
    console.log('Adding preset:', preset);
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Transformation Presets</h3>
          <Button onClick={() => setShowForm(prev => !prev)} variant={showForm ? 'danger' : 'primary'}>
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
                  size='sm'
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
