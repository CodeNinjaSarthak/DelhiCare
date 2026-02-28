import crypto from 'crypto';

/**
 * Attaches a correlation ID to every request.
 *
 * - Honours an incoming X-Request-ID header (allows external systems / load
 *   balancers to propagate their own trace IDs end-to-end).
 * - Falls back to crypto.randomUUID() — no uuid package needed (Node ≥ 14.17).
 * - Echoes the ID back in the response so clients can correlate logs.
 * - Stored on req.requestId so request logger and error handler can include it.
 */
export const correlationId = (req, res, next) => {
    const id = req.headers['x-request-id'] ?? crypto.randomUUID();
    req.requestId = id;
    res.setHeader('X-Request-ID', id);
    next();
};
