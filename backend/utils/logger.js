import winston from 'winston';
import fs from 'fs';

const isDev  = process.env.NODE_ENV !== 'production';
const isTest = process.env.NODE_ENV === 'test';

// Dev: concise coloured output. Prod: machine-readable JSON for log aggregators.
const devFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.printf(({ level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length
            ? ' ' + JSON.stringify(meta)
            : '';
        return `${level}: ${message}${metaStr}`;
    })
);

const prodFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Ensure logs/ directory exists before creating file transports.
if (!isDev) {
    fs.mkdirSync('logs', { recursive: true });
}

export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: isDev ? devFormat : prodFormat,
    // silent in Jest — no noise in test output, and existing tests need no changes.
    silent: isTest,
    transports: [
        new winston.transports.Console(),
        // File transports only in production — avoids log files during local dev.
        ...(!isDev
            ? [
                  new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
                  new winston.transports.File({ filename: 'logs/combined.log' }),
              ]
            : []),
    ],
});
