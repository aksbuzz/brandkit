import { Trash2 } from 'lucide-react';
import type { MouseEvent } from 'react';
import type { Preset } from '../types/preset';
import { IconButton } from './ui/IconButton';

interface PresetCardProps {
  preset: Preset;
  onDelete: (id: string) => Promise<void>;
}

export const PresetCard = ({ preset, onDelete }: PresetCardProps) => {
  const handleDelete = async (e: MouseEvent) => {
    e.stopPropagation();

    if (!confirm('Are you sure you want to delete this preset?')) {
      return;
    }

    try {
      await onDelete(preset.id);
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <h5 className="font-medium text-gray-900">{preset.name}</h5>
        <IconButton
          variant="default"
          size="sm"
          onClick={handleDelete}
          className="transition-colors"
        >
          <Trash2 />
        </IconButton>
      </div>
      <div className="text-sm text-gray-600 space-y-1">
        <div>
          Dimensions: {preset.width} × {preset.height}
        </div>
        <div>Format: {preset.format.toUpperCase()}</div>
        {preset.quality && <div>Quality: {preset.quality}%</div>}
      </div>
    </div>
  );
};
