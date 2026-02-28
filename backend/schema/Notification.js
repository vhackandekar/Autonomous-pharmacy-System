const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    recipientRole: { type: String, enum: ['USER', 'ADMIN'], default: 'USER' },
    type: {
        type: String,
        enum: ['refill', 'order', 'stock_alert', 'payment_failed', 'order_cancelled', 'payment', 'refund', 'prescription', 'prescription_alert', 'medicine_available'],
        required: true
    },
    message: { type: String, required: true },

    // Notification delivery tracking
    isRead: { type: Boolean, default: false },
    smsSent: { type: Boolean, default: false },    // Track if SMS was triggered
    smsDelivered: { type: Boolean, default: false }, // Track if SMS was delivered
    smsFailureReason: String,                        // Why SMS failed (if any)

    sentAt: { type: Date, default: Date.now },
    readAt: Date,
    smsSentAt: Date,
    smsDeliveredAt: Date,

    // Context for filtering
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', sparse: true },
    medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', sparse: true },

}, { timestamps: true });

// Indexes for fast queries
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ recipientRole: 1, isRead: 1 });
notificationSchema.index({ smsSent: 1, smsDelivered: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
