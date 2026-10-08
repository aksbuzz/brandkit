import { Router } from 'express';
import { validate } from '../../middleware/validator';
import {
  createAssetHandler,
  // deleteAssetHandler,
  getAssetHandler,
  getAssetsHandler,
} from './controller';
import { assetIdParamSchema, createAssetSchema, listAssetsSchema } from './schema';

const router = Router();

router.post('/', validate(createAssetSchema), createAssetHandler);
router.get('/', validate(listAssetsSchema), getAssetsHandler);
router.get('/:assetId', validate(assetIdParamSchema), getAssetHandler);
// router.delete('/:assetId', validate(assetIdParamSchema), deleteAssetHandler);

export default router;
