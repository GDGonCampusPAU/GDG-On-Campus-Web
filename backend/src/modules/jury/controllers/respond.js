/**
 * `{ success, data }` on success. Expected failures also carry a `code` for the screens;
 * everything else goes to the global error handler.
 * @param {(req: import('express').Request) => Promise<unknown>} handler
 * @param {number} [status]
 * @returns {import('express').RequestHandler}
 */
const respond = (handler, status = 200) => async (req, res, next) => {
  try {
    const data = await handler(req);
    // Only now: errorHandler would keep an already set 201 for an unexpected failure.
    res.status(status).json({ success: true, data });
  } catch (error) {
    if (!error.juryCode) return next(error);
    res.status(error.status).json({ success: false, code: error.juryCode, requestId: req.requestId, message: error.message });
  }
};

/** Scores and one-time tokens must never sit in a browser or proxy cache. */
const noStore = (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};

module.exports = { respond, noStore };
