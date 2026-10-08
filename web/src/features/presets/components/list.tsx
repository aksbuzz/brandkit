import { GalleryVerticalEnd } from 'lucide-react';
import { toast } from 'sonner';
import { PresetCard } from '../../../components/PresetCard';
import type { Preset } from '../../../types/preset';
import { useDeletePreset } from '../api/delete-preset';

type ListPresetsProps = {
  presets: Preset[];
};

export const ListPresets = ({ presets }: ListPresetsProps) => {
  const deletePresetMutation = useDeletePreset();

  if (presets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center bg-white rounded-lg shadow-sm border border-gray-200 p-12">
        <GalleryVerticalEnd size={48} className="mb-4 text-gray-400" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No presets created yet</h3>
        <p className="text-gray-500">Create your first transformation preset to get started</p>
      </div>
    );
  }

  async function handleDelete(presetId: string) {
    try {
      await deletePresetMutation.mutateAsync({ id: presetId });
      toast.success('Preset deleted successfully');
    } catch {
      // the api client already showed the server's error message
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Your Presets</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {presets.map(preset => (
          <PresetCard key={preset.id} preset={preset} onDelete={handleDelete} />
        ))}
      </div>
    </div>
  );
};
