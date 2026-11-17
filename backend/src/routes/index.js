import { Router } from 'express';
import healthRoutes from './health.routes.js';
import activityRoutes from './activity.routes.js';
import executionRoutes from './execution.routes.js';
import dashboardRoutes from './dashboard.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/activities', activityRoutes);
router.use('/executions', executionRoutes);
router.use('/dashboard', dashboardRoutes);
// Próxima etapa: router.use('/reports', ...)

export default router;
