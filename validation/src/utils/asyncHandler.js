/**
 * Wraps an async controller so a rejected promise is forwarded to Express's
 * error middleware instead of hanging the request.
 *
 * Without this, every controller needs its own try/catch — and one forgotten
 * catch means a request that never responds.
 *
 *   router.get('/', asyncHandler(async (req, res) => { ... }));
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
