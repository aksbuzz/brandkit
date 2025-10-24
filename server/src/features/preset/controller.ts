import { NextFunction, Request, Response } from 'express';
import { CreatePresetInput } from './schema';
import { db } from '../../config/database';

export const createPresetHandler = async (
  req: Request<{}, {}, CreatePresetInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const preset = await db.one(
      'INSERT INTO presets (name, width, height, format, quality) \
      VALUES (${name}, ${width}, ${height}, ${format}, ${quality}) \
      RETURNING *',
      req.body
    );
    res.status(201).json(preset);
  } catch (error) {
    next(error);
  }
};

export const getAllPresetsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const presets = await db.any('SELECT * FROM presets ORDER BY name');
    res.status(200).json(presets);
  } catch (error) {
    next(error);
  }
};

export const deletePresetHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await db.result('DELETE FROM presets WHERE id = $1', id);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Preset not found' });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
