import { logger } from '../utils/logger.js';

/**
 * HTTP access log — fires on res.finish so status code and duration are known.
 *
 * Logged fields:
 *   method     GET / POST / PATCH …
 *   url        req.originalUrl (includes query string)
 *   status     HTTP status code
 *   duration   response time in milliseconds
 *   requestId  correlation ID set by correlationId middleware
 *   hospitalId req.user._id when authenticateHospital has run, undefined otherwise
 */
export const requestLogger = (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        logger.info('http', {
            method:     req.method,
            url:        req.originalUrl,
            status:     res.statusCode,
            duration:   Date.now() - start,
            requestId:  req.requestId,
            // req.user is set by auth middleware — only present on protected routes.
            hospitalId: req.user?._id,
        });
    });

    next();
};
