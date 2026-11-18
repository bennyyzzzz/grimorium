import { Router } from 'express';
import * as controller from '../controllers/transfer.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/export', asyncHandler(controller.exportFile));
router.get('/export/preview', asyncHandler(controller.preview));
router.post('/import', asyncHandler(controller.importFile));

export default router;
