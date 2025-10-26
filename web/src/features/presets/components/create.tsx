import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/Button';
import { FormGroup } from '../../../components/ui/FormGroup';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import type { CreatePresetInput } from '../../../types/preset';
import { useCreatePreset } from '../api/create-preset';

export const CreatePreset = () => {
  const createPresetMutation = useCreatePreset();

  const [formData, setFormData] = useState<CreatePresetInput>({
    name: '',
    width: 0,
    height: 0,
    format: 'webp' as 'jpeg' | 'png' | 'webp',
    quality: 85,
  });

  async function handleSubmit() {
    await createPresetMutation.mutateAsync({ data: formData });
    toast.success('Preset created successfully');
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormGroup label="Preset Name *">
          <Input
            name="name"
            type="text"
            required
            value={formData.name}
            placeholder="e.g., Twitter Post"
            onChange={e => setFormData({ ...formData, name: e.target.value })}
          />
        </FormGroup>

        <FormGroup label="Format">
          <Select
            name="format"
            options={[
              { value: 'webp', label: 'WebP' },
              { value: 'jpeg', label: 'JPEG' },
              { value: 'png', label: 'PNG' },
            ]}
            value={formData.format}
            onChange={e =>
              setFormData({ ...formData, format: e.target.value as 'webp' | 'jpeg' | 'png' })
            }
          />
        </FormGroup>

        <FormGroup label="Width *" labelInfo="(px)">
          <Input
            type="number"
            name="width"
            value={formData.width}
            onChange={e => setFormData({ ...formData, width: +e.target.value })}
            placeholder="1024"
            required
          />
        </FormGroup>

        <FormGroup label="Height *" labelInfo="(px)">
          <Input
            type="number"
            name="height"
            value={formData.height}
            onChange={e => setFormData({ ...formData, height: +e.target.value })}
            placeholder="512"
            required
          />
        </FormGroup>

        <FormGroup label="Quality" labelInfo="(%) - Optional">
          <Input
            type="number"
            name="quality"
            min="1"
            max="100"
            value={formData.quality}
            onChange={e => setFormData({ ...formData, quality: +e.target.value })}
            placeholder="85"
          />
        </FormGroup>
      </div>

      <div className="flex justify-end">
        <Button type="submit" variant="primary">
          Create Preset
        </Button>
      </div>
    </form>
  );
};
