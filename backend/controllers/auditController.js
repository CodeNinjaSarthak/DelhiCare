import { tryCatch } from "../middlewares/error.js";
import ErrorHandler from "../utils/utilityClass.js";
import { AuditLog } from "../models/AuditLogModel.js";
import { paginate } from "../utils/paginate.js";

/**
 * GET /api/v1/audit
 * Auth: authenticateHospital (hospital reads own logs only)
 *
 * Query:
 *   hospitalId  (required)
 *   patientId   (optional)
 *   action      (optional — enum filter)
 *   page        (default: 1)
 *   limit       (default: 20, max: 100)
 */
export const getAuditLogs = tryCatch(async (req, res, next) => {
    const hospitalId = req.user._id;
    const { patientId, action } = req.query;

    const filter = { hospitalId };
    if (patientId) filter.patientId = patientId;
    if (action)    filter.action    = action;

    const result = await paginate(AuditLog, filter, {
        page:     req.query.page,
        limit:    req.query.limit,
        sort:     { createdAt: -1 },
    });

    return res.status(200).json({ success: true, ...result });
});
