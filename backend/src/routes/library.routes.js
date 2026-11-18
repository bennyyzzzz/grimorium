import { Router } from 'express';
import * as controller from '../controllers/library.controller.js';
import { uploadAttachments } from '../middlewares/upload.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(controller.list));
router.get('/tags', asyncHandler(controller.tags));
router.get('/github/status', asyncHandler(controller.githubStatus));
router.post('/import-github', asyncHandler(controller.importGithub));
router.post('/', asyncHandler(controller.create));
router.get('/:id', asyncHandler(controller.show));
router.put('/:id', asyncHandler(controller.update));
router.delete('/:id', asyncHandler(controller.remove));
router.post('/:id/sync-github', asyncHandler(controller.syncGithub));

router.post('/:id/attachments', uploadAttachments, asyncHandler(controller.uploadAttachments));
router.get('/:id/attachments/:attachmentId', asyncHandler(controller.downloadAttachment));
router.delete('/:id/attachments/:attachmentId', asyncHandler(controller.removeAttachment));

export default router;
