import mongoose from "mongoose";


const patientAdmissionSchema = new mongoose.Schema({
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'hospital',  // Reference to the Hospital collection
    required: true
  },
  patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'patient',  // Reference to the Patient collection
      required: true
  },
  bedId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'bed',  // Reference to the Bed collection
      required: true
  },
  department: {
      type: String,
      enum: ['ICU', 'General', 'Emergency'],  // Department options
      required: true
  },
  status: {
      type: String,
      enum: ['Admitted', 'Discharged'],  // Status options
      required: true
  },
  score:{
    type : Number,
    min : 1,
    max : 5,
  },
  dischargedAt: {
    type: Date,
    default: null,
  },
  dischargedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'hospital',
    default: null,
  },
  },{
    timestamps:true,
});

// Query-performance index: O(log n) lookup for reEvaluateQueue's already-admitted guard
// and any status-scoped patient queries.
patientAdmissionSchema.index({ patientId: 1, status: 1 });

// DB-level uniqueness: enforces max one 'Admitted' record per patient at the storage layer.
// Key is { patientId: 1 } only (not { patientId, status }) — partialFilterExpression limits
// scope to admitted docs, so "status" in the index key would be a constant and is redundant.
// Using a different key pattern from the query-performance index above avoids a MongoDB
// "duplicate index key pattern" error.
patientAdmissionSchema.index(
    { patientId: 1 },
    {
        unique: true,
        partialFilterExpression: { status: 'Admitted' },
        name: 'unique_admitted_per_patient',
    }
);

// Dashboard: admissions today
patientAdmissionSchema.index({ hospitalId: 1, createdAt: 1 });
// Dashboard: discharges today
patientAdmissionSchema.index({ hospitalId: 1, status: 1, dischargedAt: 1 });

export const PatientAdmission = mongoose.model("patientAdmisson",patientAdmissionSchema);