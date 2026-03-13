const mongoose = require('mongoose');

const inventoryLogSchema = new mongoose.Schema({
    medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },
    change: { type: Number, required: true }, // Positive or negative
    reason: {
        type: String,
        enum: ['ORDER_PLACED', 'REFILL', 'MANUAL_UPDATE', 'ORDER_FULFILLED', 'RESTOCK', 'ORDER_DELIVERED', 'ORDER_STATUS_REVERTED_FROM_DELIVERY', 'RETURN', 'ORDER_PLACED_VIA_AGENT', 'MANUAL_ORDER_PLACED'],
        required: true
    },
}, { timestamps: true });

module.exports = mongoose.model('InventoryLog', inventoryLogSchema);
