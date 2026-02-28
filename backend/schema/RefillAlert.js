const mongoose = require('mongoose');

const refillAlertSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },
    daysLeft: { type: Number, required: true },
    isOverdue: { type: Boolean, default: false },
    notified: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('RefillAlert', refillAlertSchema);
