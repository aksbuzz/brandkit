import assetRoutes from './asset/routes';
import presetRoutes from './preset/routes';
import { Router } from "express";

const router = Router();

router.use('/assets', assetRoutes)
router.use('/presets', presetRoutes)

export default router