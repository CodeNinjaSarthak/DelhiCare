import mongoose from "mongoose";

const AUDIT_ACTIONS = [
    'PATIENT_ADMITTED',
    'PATIENT_QUEUED',
    'QUEUE_AUTO_ALLOCATED',
    'PATIENT_DISCHARGED',
    'BED_REQUEST_APPROVED',
    'BED_REQUEST_REJECTED',
    'QUEUE_ENTRY_CANCELLED',
    'QUEUE_MANUALLY_CANCELLED',
];

const auditLogSchema = new mongoose.Schema({
    hospitalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'hospital',
        required: true,
    },
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'patient',
        default: null,
    },
    action: {
        type: String,
        enum: AUDIT_ACTIONS,
        required: true,
    },
    resourceId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    requestId: {
        type: String,
        default: null,
    },
}, {
    timestamps: { createdAt: true, updatedAt: false },
});

// Hospital timeline query
auditLogSchema.index({ hospitalId: 1, createdAt: -1 });
// Per-patient history (city-wide)
auditLogSchema.index({ patientId: 1, createdAt: -1 });
// Per-patient within a hospital (UI panel — most common UI query)
auditLogSchema.index({ hospitalId: 1, patientId: 1, createdAt: -1 });
// Action filter
auditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export { AUDIT_ACTIONS };
