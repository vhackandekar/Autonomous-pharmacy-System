const mongoose = require('mongoose');

/**
 * Prescription Schema - Version 2.0 (Clinical Alignment)
 */
const prescriptionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },

    // Core Clinical Data
    issuedBy: { type: String, default: 'Pending Extraction' },
    validTill: { type: Date },
    imageUrl: { type: String, required: true },

    // Status Lifecycle
    status: {
        type: String,
        enum: ['UPLOADED', 'OCR_PARSED', 'PENDING_ADMIN_REVIEW', 'VERIFIED', 'REJECTED', 'EXPIRED'],
        default: 'UPLOADED'
    },

    // Usage Tracking (Acute vs Chronic)
    isReusable: { type: Boolean, default: false },
    usedCount: { type: Number, default: 0 },
    isUsed: { type: Boolean, default: false },

    // Admin Controls
    adminVerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adminVerifiedAt: { type: Date },
    rejectionReason: { type: String },

    // Deep OCR Analysis Results
    extractedData: {
        confidence: { type: Number },
        detectedMedicines: [{ type: String }],
        doctorName: { type: String },
        issuedDate: { type: Date },
        dosage: { type: String },
        validationNotes: { type: String }
    }
}, { timestamps: true });

module.exports = mongoose.model('Prescription', prescriptionSchema);
