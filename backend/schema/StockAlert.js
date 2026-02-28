const mongoose = require('mongoose');

const stockAlertSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },
    notified: { type: Boolean, default: false },
    notifiedAt: { type: Date },
}, { timestamps: true });

// Ensure unique alerts per user/medicine if not notified yet
stockAlertSchema.index({ userId: 1, medicineId: 1, notified: 1 }, { unique: true });

// Index for efficient notification processing
stockAlertSchema.index({ medicineId: 1, notified: 1 });

module.exports = mongoose.model('StockAlert', stockAlertSchema);
