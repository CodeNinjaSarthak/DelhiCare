import { logger } from '../utils/logger.js';

export const errorMiddleware = (err, req, res, next) => {
    err.message    = err.message    || 'Internal Server Error';
    err.statusCode = err.statusCode || 500;

    if (err.name === 'CastError') {
        err.message    = 'Invalid Id';
        err.statusCode = 400;
    }

    // Mongoose field validation errors (required, enum, custom validator)
    if (err.name === 'ValidationError') {
        err.message    = Object.values(err.errors).map((e) => e.message).join(', ');
        err.statusCode = 400;
    }

    // MongoDB duplicate key (unique index violation)
    if (err.code === 11000) {
        const field    = Object.keys(err.keyValue ?? {})[0] ?? 'field';
        err.message    = `${field} already exists`;
        err.statusCode = 409;
    }

    // 5xx errors are bugs — log with full stack. 4xx are operational (bad input,
    // auth failures) — log at warn level without stack to keep logs clean.
    const level = err.statusCode >= 500 ? 'error' : 'warn';
    logger[level](err.message, {
        statusCode: err.statusCode,
        method:     req.method,
        url:        req.originalUrl,
        requestId:  req.requestId,
        stack:      err.statusCode >= 500 ? err.stack : undefined,
    });

    return res.status(err.statusCode).json({
        success: false,
        message: err.message,
    });
};

export const tryCatch = (func) => (req, res, next) => {
    return Promise.resolve(func(req, res, next)).catch(next);
};
