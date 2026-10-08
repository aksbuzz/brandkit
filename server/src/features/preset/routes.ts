import { Router } from 'express';
import { validate } from '../../middleware/validator';
import { createPresetHandler, deletePresetHandler, getAllPresetsHandler } from './controller';
import { createPresetSchema, presetIdParamSchema } from './schema';

const router = Router();

router.post('/', validate(createPresetSchema), createPresetHandler);
router.get('/', getAllPresetsHandler);
router.delete('/:id', validate(presetIdParamSchema), deletePresetHandler);

export default router;
