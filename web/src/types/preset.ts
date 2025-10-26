export interface Preset {
  id: string;
  name: string;
  width: number;
  height: number;
  format: "jpeg" | "webp" | "png";
  quality?: number;
  created_at: Date;
  updated_at: Date;
}

export type CreatePresetInput = Omit<Preset, 'id' | 'created_at' | 'updated_at'>;