import { Router } from 'express';
import * as controller from '../controllers/execution.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(controller.byDate));

export default router;
