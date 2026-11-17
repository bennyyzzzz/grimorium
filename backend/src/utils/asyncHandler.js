// Express 5 já propaga erros de handlers async, mas mantemos o wrapper
// explícito para deixar a intenção clara e facilitar uma eventual migração.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
