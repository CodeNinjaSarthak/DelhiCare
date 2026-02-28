import { Bed } from "../models/bedModel.js";
import { WaitingQueue } from "../models/WaitingQueueModel.js";
import { PatientAdmission } from "../models/patientAdmissionModel.js";
import { Patient } from "../models/patientModel.js";
import { sendSms } from "../utils/sendSMS.js";
import { io } from "../app.js";
import { logger } from "../utils/logger.js";
import { logAudit } from "./auditService.js";

/**
 * reEvaluateQueue — core bed allocation engine.
 *
 * Called by:
 *   - dischargePatient controller (event-triggered)
 *   - cron job (safety-net, every 5 min)
 *
 * Concurrency guarantees (document-atomic, not transactional):
 *   - Atomic bed claim prevents two callers from claiming the same bed.
 *   - Atomic queue claim prevents the same patient from being admitted twice.
 *   - Already-admitted guard catches patients manually admitted while in queue.
 *   - Failure revert undoes partial writes on PatientAdmission.create failure.
 *   - Loop cap prevents infinite loops on repeated cancel-revert failure.
 *
 * @param {string|ObjectId} hospitalId
 * @param {string|null} department  — 'ICU' | 'General' | 'Emergency' | null (all)
 * @returns {{ allocatedCount: number }}
 */
export const reEvaluateQueue = async (hospitalId, department = null) => {
    const departments = department
        ? [department]
        : ['ICU', 'General', 'Emergency'];

    let allocatedCount = 0;

    for (const dept of departments) {
        // Compute loop cap once before the loop starts.
        // This guards against infinite loops on repeated cancel-revert failure.
        // It does not guarantee all valid allocations complete — remaining work
        // is picked up by the next cron tick.
        const initialFreeBedCount = await Bed.countDocuments({
            hospitalId,
            department: dept,
            isOccupied: false,
        });
        const maxIterations = initialFreeBedCount + 1;
        let iterations = 0;

        while (iterations < maxIterations) {
            iterations++;

            // PRIMARY GUARD: atomic bed claim.
            // findOneAndUpdate is a single atomic document op — two concurrent
            // callers cannot claim the same bed.
            const claimedBed = await Bed.findOneAndUpdate(
                { hospitalId, department: dept, isOccupied: false },
                { $set: { isOccupied: true } },
                { new: true }
            );

            if (!claimedBed) {
                // No more free beds in this department.
                break;
            }

            // SECONDARY GUARD: atomic queue claim, highest score first.
            // createdAt: 1 is the tiebreaker — equal-score patients are served
            // in FIFO order.
            const queueEntry = await WaitingQueue.findOneAndUpdate(
                { hospitalId, department: dept, status: 'Waiting' },
                { $set: { status: 'Admitted', admittedAt: new Date() } },
                { new: true, sort: { score: -1, createdAt: 1 } }
            );

            if (!queueEntry) {
                // Orphan bed — no waiting patients. Release and stop this dept.
                await Bed.findByIdAndUpdate(claimedBed._id, {
                    $set: { isOccupied: false },
                });
                break;
            }

            // ALREADY-ADMITTED GUARD: patient may have been manually admitted
            // while still in the queue (e.g., walk-in direct admission).
            // Uses { patientId, status } index for O(log n) lookup.
            const existingAdmission = await PatientAdmission.findOne({
                patientId: queueEntry.patientId,
                status: 'Admitted',
            });

            if (existingAdmission) {
                // Release bed; mark this queue entry Cancelled (corrupt state cleanup).
                await Bed.findByIdAndUpdate(claimedBed._id, {
                    $set: { isOccupied: false },
                });
                await WaitingQueue.findByIdAndUpdate(queueEntry._id, {
                    $set: { status: 'Cancelled', cancelledAt: new Date() },
                });
                // Structured log — this is a state mutation, not silent cleanup.
                logger.info('Queue entry cancelled: patient already admitted', {
                    patientId:           queueEntry.patientId,
                    queueEntryId:        queueEntry._id,
                    existingAdmissionId: existingAdmission._id,
                    requestId:           undefined, // no req context here
                });
                // Audit: QUEUE_ENTRY_CANCELLED (non-fatal, fire-and-forget)
                logAudit({
                    hospitalId,
                    patientId:  queueEntry.patientId,
                    action:     'QUEUE_ENTRY_CANCELLED',
                    resourceId: queueEntry._id,
                    metadata:   {
                        queueEntryId:        queueEntry._id,
                        existingAdmissionId: existingAdmission._id,
                    },
                });
                // Continue loop — try next waiting patient.
                continue;
            }

            // Create admission record — with full revert on failure.
            let newAdmission;
            try {
                newAdmission = await PatientAdmission.create({
                    hospitalId,
                    patientId:  queueEntry.patientId,
                    bedId:      claimedBed._id,
                    department: dept,
                    status:     'Admitted',
                    score:      queueEntry.score,
                });
                allocatedCount++;
                // Audit: QUEUE_AUTO_ALLOCATED
                await logAudit({
                    hospitalId,
                    patientId:  queueEntry.patientId,
                    action:     'QUEUE_AUTO_ALLOCATED',
                    resourceId: newAdmission._id,
                    metadata:   {
                        department:   dept,
                        bedId:        claimedBed._id,
                        queueEntryId: queueEntry._id,
                        admissionId:  newAdmission._id,
                    },
                });
            } catch (err) {
                // Strict revert: undo exactly what was written, nothing more.
                // Brief window where queue status was 'Admitted' — another caller
                // may have skipped this entry. Reverting to 'Waiting' makes it
                // visible again for the next cron tick.
                await Bed.findByIdAndUpdate(claimedBed._id, {
                    $set: { isOccupied: false },
                });
                await WaitingQueue.findByIdAndUpdate(queueEntry._id, {
                    $set: { status: 'Waiting', admittedAt: null },
                });
                logger.error('PatientAdmission.create failed, reverted bed + queue', {
                    bedId:        claimedBed._id,
                    queueEntryId: queueEntry._id,
                    error:        err.message,
                });
                // Stop processing this department on failure.
                break;
            }

            // FIRE AND FORGET: SMS notification.
            // Do NOT await — do NOT block the allocation loop on Twilio.
            Patient.findById(queueEntry.patientId)
                .then((patient) => {
                    if (!patient) return;
                    const msg = `A bed has been allocated to you in the ${dept} department. Please report to the hospital.`;
                    const emergencyMsg = `Your family member has been allocated a bed in the ${dept} department at the hospital.`;
                    sendSms(`+91${patient.contactNumber}`, msg).catch((err) =>
                        logger.error('SMS failed (patient)', { error: err.message })
                    );
                    if (patient.emergencyContact?.contactNumber) {
                        sendSms(`+91${patient.emergencyContact.contactNumber}`, emergencyMsg).catch((err) =>
                            logger.error('SMS failed (emergency contact)', { error: err.message })
                        );
                    }
                })
                .catch((err) =>
                    logger.error('Patient lookup for SMS failed', { error: err.message })
                );

            // Socket emit — synchronous, no I/O wait.
            io.to(`hospital_${hospitalId}`).emit('queuePatientAdmitted', {
                queueEntryId: queueEntry._id,
                patientId:    queueEntry.patientId,
                bedId:        claimedBed._id,
                department:   dept,
                admittedAt:   queueEntry.admittedAt,
            });
        }
    }

    logger.info('reEvaluateQueue completed', { hospitalId, department, allocatedCount });
    return { allocatedCount };
};
