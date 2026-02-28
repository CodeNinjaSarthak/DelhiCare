import rateLimit from 'express-rate-limit';

// Shared JSON error response — keeps rate-limit errors consistent with the
// rest of the API's { success, message } envelope.
const handler = (req, res) =>
    res.status(429).json({
        success: false,
        message: 'Too many requests, please try again later.',
    });

/**
 * Auth rate limiter — login / register endpoints.
 * 10 requests per 15-minute window per IP.
 * Tight limit: these endpoints are the attack surface for credential stuffing.
 */
export const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    handler,
    // RateLimit-* response headers (draft-7 spec); no deprecated X-RateLimit headers.
    standardHeaders: 'draft-7',
    legacyHeaders: false,
});

/**
 * Bed-request rate limiter — patient bed allotment request endpoints.
 * 20 requests per 15-minute window per IP.
 * Looser than auth: legitimate use requires more requests, but still bounded
 * to prevent queue flooding.
 */
export const bedRequestRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    handler,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
});
