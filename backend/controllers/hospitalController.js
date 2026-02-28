import { tryCatch } from "../middlewares/error.js";

import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import createToken from "./../utils/createToken.js";
import ErrorHandler from "../utils/utilityClass.js";
import { Hospital } from "../models/hospitalModel.js";
import { Notification } from "../models/notificationModel.js";
import { Bed } from "../models/bedModel.js";
import { WaitingQueue } from "../models/WaitingQueueModel.js";
import { PatientAdmission } from "../models/patientAdmissionModel.js";
import { HospitalPolicy } from "../models/HospitalPolicyModel.js";
import { calculatePriority, DEFAULT_WEIGHTS } from "../utils/bedAllotment.js";
import { sendSms } from "../utils/sendSMS.js";
import { io } from "../app.js";
import { reEvaluateQueue } from "../services/bedAllocationService.js";
import { logger } from "../utils/logger.js";
import { logAudit } from "../services/auditService.js";
import { paginate } from "../utils/paginate.js";

export const registerHospital = tryCatch(async (req, res, next) => {
  const {
      name,
      registrationNumber,
      email,
      password,
      contactNumber,
      address,
      location
  } = req.body;

  if (!name || !registrationNumber || !email || !password || !contactNumber || !address || !location || !location.coordinates || location.coordinates.length !== 2) {
      return next(new ErrorHandler("Please fill in all required fields", 400));
  }

  const { street, locality, city, pinCode } = address;
  if (!street || !locality || !city || !pinCode) {
      return next(new ErrorHandler("Please provide a complete address", 400));
  }

  const hospitalExists = await Hospital.findOne({
      $or: [{ email }, { registrationNumber }]
  });
  if (hospitalExists) {
      return next(new ErrorHandler("Hospital already registered", 401));
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const hospital = await Hospital.create({
      name,
      registrationNumber,
      email,
      password: hashedPassword,
      address: { street, locality, city, pinCode },
      contactNumber,
      location: {
          type: "Point",
          coordinates: location.coordinates,
      },
  });

  createToken(res, hospital._id);

  return res.status(200).json({
      success: true,
      message: `Hospital ${hospital.name} registered successfully`,
  });
});

export const loginHospital = tryCatch(async (req, res, next) => {
    const { email, password } = req.body;
    const hospital = await Hospital.findOne({ email });
    if (!hospital) {
        return next(new ErrorHandler("Invalid credentials", 401));
    }
    const isPasswordValid = await bcrypt.compare(password, hospital.password);
    if (!isPasswordValid) {
        return next(new ErrorHandler("Invalid credentials", 401));
    }
    createToken(res, hospital._id);
    return res.status(201).json({
        success: true,
        message: `Welcome, ${hospital.name}`,
    });
});

export const logoutHospital = tryCatch(async (req, res, next) => {
    res.cookie("jwt", "", {
        httpOnly: true,
        expires: new Date(0),
    });
    res.status(201).json({
        success: true,
        message: "Logged out successfully",
    });
});

export const getHospitalPatients = tryCatch(async (req, res, next) => {
    const hospitalId = req.user._id;
    const { status } = req.query;

    const filter = { hospitalId };
    if (status) filter.status = status;

    const result = await paginate(PatientAdmission, filter, {
        page:     req.query.page,
        limit:    req.query.limit,
        populate: 'patientId bedId',
    });

    return res.status(200).json({ success: true, ...result });
});

export const getBedRequests = tryCatch(async (req, res, next) => {
    const result = await paginate(
        Notification,
        {},
        {
            page:     req.query.page,
            limit:    req.query.limit,
            sort:     { createdAt: 1 },
            populate: 'patientId hospitalId',
        }
    );
    return res.status(200).json({ success: true, ...result });
});

export const handleBedAllotmentRequest = tryCatch(async (req, res, next) => {
  const { notificationId, action, score } = req.body;

  if (!notificationId || !action || score === undefined) {
      return next(new ErrorHandler("Please provide notification ID, action, and score", 400));
  }

  const validActions = ['Approve', 'Reject'];
  if (!validActions.includes(action)) {
      return next(new ErrorHandler("Invalid action", 400));
  }

  const notification = await Notification.findById(notificationId).populate('patientId');
  if (!notification) {
      return next(new ErrorHandler("Notification not found", 404));
  }

  notification.status = action === 'Approve' ? 'Approved' : 'Rejected';
  notification.score = score;
  await notification.save();

  const hospitalId = notification.hospitalId;

  if (action === 'Approve') {
      const patient = notification.patientId;

      // Load hospital policy for configurable scoring weights
      const policy = await HospitalPolicy.findOne({ hospitalId }).lean();
      const weights = policy?.scoringWeights ?? DEFAULT_WEIGHTS;
      const priorityScore = calculatePriority(patient, score, weights);

      // Audit: BED_REQUEST_APPROVED
      await logAudit({
          hospitalId,
          patientId:  patient._id,
          action:     'BED_REQUEST_APPROVED',
          resourceId: notification._id,
          metadata:   { department: patient.department, notificationId: notification._id },
          requestId:  req.requestId ?? null,
      });

      const availableBeds = await Bed.find({
          hospitalId:  notification.hospitalId,
          department:  patient.department,
          isOccupied:  false,
      });

      if (availableBeds.length === 0) {
          const queueEntry = await WaitingQueue.create({
              patientId:  new mongoose.Types.ObjectId(patient._id),
              hospitalId: new mongoose.Types.ObjectId(notification.hospitalId),
              department: patient.department,
              score:      priorityScore,
              status:     'Waiting',
          });

          await logAudit({
              hospitalId,
              patientId:  patient._id,
              action:     'PATIENT_QUEUED',
              resourceId: queueEntry._id,
              metadata:   {
                  department:   patient.department,
                  score:        priorityScore,
                  queueEntryId: queueEntry._id,
              },
              requestId: req.requestId ?? null,
          });

          const patientContactNumber = patient.contactNumber;
          await sendSms(
              `+91${patientContactNumber}`,
              `Your bed allotment request has been approved with a priority score of ${notification.score}, but currently, there are no available beds. You have been placed in a waiting queue.`
          );

          return res.status(200).json({
              success: true,
              message: "No available beds. Patient added to the waiting queue.",
              data:    notification,
          });
      }

      // Mark bed occupied
      const bestBed = availableBeds[0];
      bestBed.isOccupied = true;
      await bestBed.save();

      const patientAdmission = await PatientAdmission.create({
          hospitalId: new mongoose.Types.ObjectId(notification.hospitalId),
          patientId:  new mongoose.Types.ObjectId(patient._id),
          bedId:      new mongoose.Types.ObjectId(bestBed._id),
          department: patient.department,
          status:     'Admitted',
          score:      notification.score,
      });

      await logAudit({
          hospitalId,
          patientId:  patient._id,
          action:     'PATIENT_ADMITTED',
          resourceId: patientAdmission._id,
          metadata:   {
              department:  patient.department,
              bedId:       bestBed._id,
              score:       priorityScore,
              admissionId: patientAdmission._id,
          },
          requestId: req.requestId ?? null,
      });

      const patientContactNumber = patient.contactNumber;
      await sendSms(
          `+91${patientContactNumber}`,
          `Your bed allotment request has been approved and a bed has been allocated to you with a priority score of ${notification.score}.`
      );

      io.to(`hospital_${notification.hospitalId}`).emit('bedAllotmentResponse', {
          notificationId,
          status:  notification.status,
          bedId:   bestBed._id,
          score:   notification.score,
      });

      return res.status(200).json({
          success: true,
          message: "Bed allotment request approved and bed allocated successfully",
          data:    patientAdmission,
      });
  } else {
      // Reject
      await logAudit({
          hospitalId,
          patientId:  notification.patientId._id,
          action:     'BED_REQUEST_REJECTED',
          resourceId: notification._id,
          metadata:   {
              department:     notification.patientId.department,
              notificationId: notification._id,
          },
          requestId: req.requestId ?? null,
      });

      await notification.deleteOne();
      const patientContactNumber = notification.patientId.contactNumber;
      await sendSms(
          patientContactNumber,
          `Your bed allotment request has been rejected. Please contact the hospital for further details.`
      );
      return res.status(200).json({
          success: true,
          message: "Request rejected successfully",
          data:    notification,
      });
  }
});

/**
 * PATCH /api/v1/hospital/discharge/:admissionId
 *
 * Ordered writes:
 *   1. READ  admission (404 / 403 / 400 guards)
 *   2. WRITE Bed → isOccupied: false
 *   3. WRITE PatientAdmission → status: 'Discharged'
 *   4. AUDIT logAudit (before queue re-evaluation, before 200)
 *   5. CALL  reEvaluateQueue
 *   6. ASYNC SMS fire-and-forget
 *   7. EMIT  socket event
 *   8. RETURN 200
 */
export const dischargePatient = tryCatch(async (req, res, next) => {
    const { admissionId } = req.params;
    const hospitalId = req.user._id;

    // 1. READ
    const admission = await PatientAdmission.findById(admissionId).populate('patientId');
    if (!admission) {
        return next(new ErrorHandler('Admission not found', 404));
    }
    if (admission.hospitalId.toString() !== hospitalId.toString()) {
        return next(new ErrorHandler('Not authorized to discharge this patient', 403));
    }
    if (admission.status === 'Discharged') {
        return next(new ErrorHandler('Patient has already been discharged', 400));
    }

    // 2. WRITE — Free the bed
    await Bed.findOneAndUpdate(
        { _id: admission.bedId, hospitalId },
        { $set: { isOccupied: false } }
    );

    // 3. WRITE — Mark admission Discharged
    const updatedAdmission = await PatientAdmission.findByIdAndUpdate(
        admissionId,
        {
            $set: {
                status:       'Discharged',
                dischargedAt: new Date(),
                dischargedBy: hospitalId,
            },
        },
        { new: true }
    );

    // 4. AUDIT
    await logAudit({
        hospitalId,
        patientId:  admission.patientId?._id ?? admission.patientId,
        action:     'PATIENT_DISCHARGED',
        resourceId: admissionId,
        metadata:   {
            department: admission.department,
            bedId:      admission.bedId,
        },
        requestId: req.requestId ?? null,
    });

    // 5. CALL — Event-triggered queue re-evaluation
    await reEvaluateQueue(hospitalId, admission.department);

    // 6. ASYNC SMS — Fire-and-forget
    const patient = admission.patientId;
    if (patient) {
        const dischargeMsg = `You have been discharged from the hospital. We wish you a speedy recovery.`;
        const emergencyMsg = `Your family member has been discharged from the hospital.`;
        sendSms(`+91${patient.contactNumber}`, dischargeMsg).catch((err) =>
            logger.error('dischargePatient: SMS failed (patient)', { error: err.message, admissionId })
        );
        if (patient.emergencyContact?.contactNumber) {
            sendSms(`+91${patient.emergencyContact.contactNumber}`, emergencyMsg).catch((err) =>
                logger.error('dischargePatient: SMS failed (emergency contact)', { error: err.message, admissionId })
            );
        }
    }

    // 7. EMIT
    io.to(`hospital_${hospitalId}`).emit('patientDischarged', {
        admissionId,
        patientId:    admission.patientId?._id ?? admission.patientId,
        patientName:  patient?.name,
        bedId:        admission.bedId,
        department:   admission.department,
        dischargedAt: updatedAdmission.dischargedAt,
    });

    // 8. RETURN
    return res.status(200).json({
        success: true,
        data: updatedAdmission,
    });
});

/**
 * GET /api/v1/hospital/queue
 * Paginated waiting queue, optionally filtered by department
 */
export const getHospitalQueue = tryCatch(async (req, res, next) => {
    const hospitalId = req.user._id;
    const { department } = req.query;

    const filter = { hospitalId, status: 'Waiting' };
    if (department) filter.department = department;

    const result = await paginate(WaitingQueue, filter, {
        page:     req.query.page,
        limit:    req.query.limit,
        sort:     { score: -1, createdAt: 1 },
        populate: 'patientId',
    });

    return res.status(200).json({ success: true, ...result });
});

/**
 * DELETE /api/v1/hospital/queue/:queueId
 * Hospital admin manually cancels a waiting queue entry
 */
export const cancelQueueEntry = tryCatch(async (req, res, next) => {
    const { queueId } = req.params;
    const hospitalId  = req.user._id;
    const { reason }  = req.body;

    const queueEntry = await WaitingQueue.findById(queueId);
    if (!queueEntry) {
        return next(new ErrorHandler('Queue entry not found', 404));
    }
    if (queueEntry.hospitalId.toString() !== hospitalId.toString()) {
        return next(new ErrorHandler('Not authorized to cancel this queue entry', 403));
    }
    if (queueEntry.status !== 'Waiting') {
        return next(new ErrorHandler('Only Waiting queue entries can be cancelled', 400));
    }

    await WaitingQueue.findByIdAndUpdate(queueId, {
        $set: { status: 'Cancelled', cancelledAt: new Date() },
    });

    await logAudit({
        hospitalId,
        patientId:  queueEntry.patientId,
        action:     'QUEUE_MANUALLY_CANCELLED',
        resourceId: queueId,
        metadata:   {
            queueEntryId: queueId,
            department:   queueEntry.department,
            ...(reason ? { reason } : {}),
        },
        requestId: req.requestId ?? null,
    });

    return res.status(200).json({
        success: true,
        message: 'Queue entry cancelled successfully',
    });
});

/**
 * GET /api/v1/hospital/policy
 */
export const getPolicy = tryCatch(async (req, res, next) => {
    const hospitalId = req.user._id;
    const policy = await HospitalPolicy.findOne({ hospitalId }).lean();
    if (!policy) {
        return res.status(200).json({
            success: true,
            data: { scoringWeights: DEFAULT_WEIGHTS, version: 0 },
        });
    }
    return res.status(200).json({ success: true, data: policy });
});

/**
 * PUT /api/v1/hospital/policy
 */
export const updatePolicy = tryCatch(async (req, res, next) => {
    const hospitalId = req.user._id;
    const { scoringWeights } = req.body;

    if (!scoringWeights) {
        return next(new ErrorHandler('scoringWeights is required', 400));
    }

    const updated = await HospitalPolicy.findOneAndUpdate(
        { hospitalId },
        { $set: { scoringWeights }, $inc: { version: 1 } },
        { upsert: true, new: true }
    );

    return res.status(200).json({ success: true, data: updated });
});

/**
 * GET /api/v1/hospital/me
 * Returns the current authenticated hospital's profile (minus password)
 */
export const getMe = tryCatch(async (req, res, next) => {
    return res.status(200).json({ success: true, data: req.user });
});
