import { AuditLog } from "../models/AuditLogModel.js";
import { logger } from "../utils/logger.js";

/**
 * logAudit — write an audit record, swallowing errors.
 *
 * Non-transactional contract:
 *   Audit writes are non-transactional but strongly consistent in normal operation.
 *   In the failure case (Mongo write error on AuditLog), the business event has occurred
 *   but no audit record exists. This is a known, accepted trade-off: availability over
 *   audit completeness. The warn-level log makes every such gap observable.
 *
 * @param {{ hospitalId, patientId?, action, resourceId, metadata?, requestId? }} data
 */
export const logAudit = async (data) => {
    try {
        await AuditLog.create(data);
    } catch (err) {
        logger.warn('Audit log write failed (non-fatal)', {
            error:      err.message,
            action:     data.action,
            hospitalId: data.hospitalId,
            patientId:  data.patientId,
            resourceId: data.resourceId,
        });
    }
};
