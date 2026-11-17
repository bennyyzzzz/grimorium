import { Router } from 'express';
import * as controller from '../controllers/activity.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(controller.list));
router.get('/categories', asyncHandler(controller.categories));
router.post('/', asyncHandler(controller.create));
router.post('/contacts', asyncHandler(controller.createContact));
router.get('/:id', asyncHandler(controller.show));
router.put('/:id', asyncHandler(controller.update));
router.delete('/:id', asyncHandler(controller.remove));
router.patch('/:id/status', asyncHandler(controller.changeStatus));
router.post('/:id/logs', asyncHandler(controller.addLog));
router.delete('/:id/logs/:logId', asyncHandler(controller.removeLog));

export default router;
