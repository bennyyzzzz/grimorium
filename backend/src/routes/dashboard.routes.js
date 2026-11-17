import { Router } from 'express';
import * as controller from '../controllers/dashboard.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(controller.show));

export default router;
