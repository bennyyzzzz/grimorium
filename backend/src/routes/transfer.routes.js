import { Router } from 'express';
import * as controller from '../controllers/transfer.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uploadBackup } from '../middlewares/upload.js';

const router = Router();

router.get('/export', asyncHandler(controller.exportFile));
router.get('/export/preview', asyncHandler(controller.preview));
router.post('/import', asyncHandler(controller.importFile));
router.post('/import-zip', uploadBackup, asyncHandler(controller.importZip));

export default router;
