import { getExecutionsByDate } from '../services/execution.service.js';
import { parseExecutionDate } from '../validators/activity.validator.js';

// GET /api/executions?date=YYYY-MM-DD — atividades efetivamente executadas no dia.
export async function byDate(req, res) {
  res.json(await getExecutionsByDate(parseExecutionDate(req.query.date)));
}
