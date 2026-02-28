import { tryCatch } from "../middlewares/error.js";
import cron from "node-cron";
import { Bed } from "../models/bedModel.js";
import { Notification } from "../models/notificationModel.js";
import { PatientAdmission } from "../models/patientAdmissionModel.js";
import { Patient } from "../models/patientModel.js";
import ErrorHandler from "../utils/utilityClass.js";
import { io } from '../app.js';

import mongoose from "mongoose";

import { Hospital } from "../models/hospitalModel.js";
import { WaitingQueue } from "../models/WaitingQueueModel.js";
import { reEvaluateQueue } from "../services/bedAllocationService.js";
import { logger } from "../utils/logger.js";


// Request bed allotment
export const requestBedAllotment = tryCatch(async (req, res, next) => {
    const { patientId, hospitalId } = req.body;

    if (!patientId || !hospitalId) {
        return next(new ErrorHandler("Please provide patient ID and hospital ID", 400));
    }

    const patient = await Patient.findById(patientId);
    if (!patient) {
        return next(new ErrorHandler("Patient not found", 404));
    }

    const message = `A bed allotment request has been made for patient ${patient.name} in the ${patient.department} department.`;

    const notification = await Notification.create({
        hospitalId,
        patientId,
        message
    });

    // Send notification to hospital admin
    io.to(`hospital_${hospitalId}`).emit('bedAllotmentRequest', notification);

    res.status(200).json({
        success: true,
        message: "Bed allotment request sent successfully",
        data: notification
    });
});


// Safety-net cron: runs every 5 minutes to catch any beds freed by crashes or
// other out-of-band events that discharge's event-trigger may have missed.
// Pre-filters to hospitals that actually have waiting patients — avoids a full
// bed scan when the queue is empty.
const runCronAllocation = async () => {
    try {
        const hospitalIds = await WaitingQueue.distinct('hospitalId', { status: 'Waiting' });
        if (hospitalIds.length === 0) return;

        for (const hospitalId of hospitalIds) {
            await reEvaluateQueue(hospitalId, null); // all departments; exits fast if no free beds
        }
    } catch (error) {
        logger.error('cron runCronAllocation failed', { error: error.message, stack: error.stack });
    }
};

// Changed from 30 min to 5 min — with event-triggered discharge, cron is a
// crash-recovery safety net and should correct orphaned state quickly.
cron.schedule('*/5 * * * *', runCronAllocation);

export const createPatient = tryCatch(async (req, res, next) => {
    const {
        name,
        age,
        gender,
        contactNumber,
        email,
        address: { street, locality, city, pinCode } = {},
        department,
        reasonForAdmission,
        latitude,
        longitude,
        emergencyContact: { name: emergencyName, contactNumber: emergencyContactNumber } = {},
    } = req.body;

    // Validate the incoming data
    if (
        !name || !age || !gender || !contactNumber || !email ||
        !street || !locality || !city || !pinCode ||
        !department || !latitude || !longitude ||
        !emergencyName || !emergencyContactNumber
    ) {
        return next(new ErrorHandler('Please provide all required fields', 400));
    }

    // Attempt to parse latitude and longitude to ensure they are numbers
    const parsedLatitude = parseFloat(latitude);
    const parsedLongitude = parseFloat(longitude);

    if (isNaN(parsedLatitude) || isNaN(parsedLongitude)) {
        return next(new ErrorHandler('Invalid latitude or longitude', 400));
    }

    // Create the patient record in the database
    const newPatient = await Patient.create({
        name,
        age,
        gender,
        contactNumber,
        email,
        address: { street, locality, city, pinCode },
        department,
        reasonForAdmission,
        location: { type: "Point", coordinates: [parsedLongitude, parsedLatitude] },
        emergencyContact: {
            name: emergencyName,
            contactNumber: emergencyContactNumber
        }
    });

    // Find the closest hospitals based on the patient's location
    const closestHospitals = await Hospital.aggregate([
        {
            $geoNear: {
                near: { type: "Point", coordinates: [parsedLongitude, parsedLatitude] },
                distanceField: "distance",
                spherical: true,
            }
        },
        {
            $lookup: {
                from: "beds", // The 'beds' collection
                localField: "_id",
                foreignField: "hospitalId",
                as: "beds"
            }
        },
        {
            $addFields: {
                availableBedsCount: {
                    $size: "$beds" // Count the total number of beds, irrespective of department
                }
            }
        },
        {
            $project: {
                name: 1,
                address: 1,
                latitude: 1,
                longitude: 1,
                distance: { $divide: ["$distance", 1000] }, // Convert distance to kilometers
                availableBedsCount: 1
            }
        },
        {
            $sort: { distance: 1 } // Sort by distance in ascending order (nearest first)
        }
    ]);

    // Respond with the newly created patient and the closest hospitals
    res.status(201).json({
        success: true,
        message: "Patient created successfully",
        data: {
            patient: newPatient,
            closestHospitals
        }
    });
});
