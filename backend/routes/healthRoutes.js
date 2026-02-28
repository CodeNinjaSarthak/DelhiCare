import express from 'express';
import mongoose from 'mongoose';
import { Bed } from '../models/bedModel.js';
import { WaitingQueue } from '../models/WaitingQueueModel.js';

const router = express.Router();

// mongoose.connection.readyState → human-readable label.
const DB_STATE = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
};

/**
 * GET /health
 *
 * Returns operational signal for monitoring / load-balancer health checks.
 * 200 → system healthy (DB connected).
 * 503 → system degraded (DB not connected); load balancers should stop routing.
 *
 * DB-dependent counts (waitingQueue, freeBeds) are null when DB is unreachable
 * to avoid a secondary failure masking the primary one.
 *
 * No auth required — health endpoints must be reachable even when auth is broken.
 */
router.get('/', async (req, res) => {
    const readyState = mongoose.connection.readyState;
    const dbStatus   = DB_STATE[readyState] ?? 'unknown';
    const healthy    = readyState === 1;

    // Only hit the DB for counts when we know the connection is live.
    const [waitingQueue, freeBeds] = healthy
        ? await Promise.all([
              WaitingQueue.countDocuments({ status: 'Waiting' }),
              Bed.countDocuments({ isOccupied: false }),
          ])
        : [null, null];

    const mem = process.memoryUsage();

    return res.status(healthy ? 200 : 503).json({
        status:       healthy ? 'ok' : 'degraded',
        db:           dbStatus,
        waitingQueue,
        freeBeds,
        uptime:       Math.floor(process.uptime()),         // seconds
        memory: {
            heapUsedMB:  Math.round(mem.heapUsed  / 1024 / 1024),
            heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        },
    });
});

export default router;
