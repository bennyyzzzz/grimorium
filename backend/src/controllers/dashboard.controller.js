import { getDashboard } from '../services/dashboard.service.js';
import { parsePeriod } from '../validators/activity.validator.js';

// GET /api/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD (padrão: hoje)
export async function show(req, res) {
  res.json(await getDashboard(parsePeriod(req.query)));
}
