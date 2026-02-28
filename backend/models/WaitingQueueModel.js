import mongoose from "mongoose";

const waitingQueueSchema = new mongoose.Schema({
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'patient',
        required: true
    },
    hospitalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'hospital',
        required: true
    },
    department: {
        type: String,
        enum: ['ICU', 'General', 'Emergency'],
        required: true
    },
    score: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['Waiting', 'Admitted', 'Cancelled'],
        default: 'Waiting'
    },
    admittedAt: {
        type: Date,
        default: null,
    },
    cancelledAt: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true,
});

// Supports reEvaluateQueue's atomic queue claim query: sort by score DESC, createdAt ASC.
// createdAt is the tiebreaker — without it, equal-score patients may reorder unpredictably.
waitingQueueSchema.index({ hospitalId: 1, department: 1, status: 1, score: -1, createdAt: 1 });

// Dashboard: average allocation time today
waitingQueueSchema.index({ hospitalId: 1, status: 1, admittedAt: 1 });

export const WaitingQueue = mongoose.model("WaitingQueue", waitingQueueSchema);
