import { Router } from 'express';
import { validate } from '../../middleware/validator';
import {
  createAssetHandler,
  // deleteAssetHandler,
  getAssetHandler,
  getAssetsHandler,
} from './controller';
import { createAssetSchema } from './schema';

const router = Router();

router.post('/', validate(createAssetSchema), createAssetHandler);
router.get('/', getAssetsHandler);
router.get('/:assetId', getAssetHandler);
// router.delete('/:assetId', deleteAssetHandler);

export default router;
