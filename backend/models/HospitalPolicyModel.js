import mongoose from "mongoose";

const hospitalPolicySchema = new mongoose.Schema({
    hospitalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'hospital',
        required: true,
        unique: true,
    },
    scoringWeights: {
        ageWeight: {
            type: Number,
            default: 1.0,
            min: 0,
            max: 3,
        },
        severityWeight: {
            type: Number,
            default: 1.0,
            min: 0,
            max: 3,
        },
        emergencyWeight: {
            type: Number,
            default: 1.0,
            min: 0,
            max: 3,
        },
        icuWeight: {
            type: Number,
            default: 1.0,
            min: 0,
            max: 3,
        },
        adminScoreWeight: {
            type: Number,
            default: 1.0,
            min: 0,
            max: 3,
        },
    },
    // Informational only — incremented on each PUT. No behavioral use.
    version: {
        type: Number,
        default: 1,
    },
}, {
    timestamps: true,
});

export const HospitalPolicy = mongoose.model('HospitalPolicy', hospitalPolicySchema);
