const mongoose = require('mongoose');

const inventoryLogSchema = new mongoose.Schema({
    medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },
    change: { type: Number, required: true }, // Positive or negative
    reason: {
        type: String,
        enum: [
            'ORDER_PLACED',
            'REFILL',
            'MANUAL_UPDATE',
            'ORDER_FULFILLED',
            'RESTOCK',
            'ORDER_DELIVERED',
            'ORDER_STATUS_REVERTED_FROM_DELIVERY',
            'RETURN',
            'ORDER_PLACED_VIA_AGENT',
            'MANUAL_ORDER_PLACED',
            'ORDER_CANCELLED',
            'ORDER_STATUS_CHANGED_TO_PENDING',
            'ORDER_STATUS_CHANGED_TO_CONFIRMED',
            'ORDER_STATUS_CHANGED_TO_OUT_FOR_DELIVERY',
            'ORDER_STATUS_CHANGED_TO_DELIVERED',
            'ORDER_STATUS_CHANGED_TO_CANCELLED'
        ],
        required: true
    },
}, { timestamps: true });

module.exports = mongoose.model('InventoryLog', inventoryLogSchema);
