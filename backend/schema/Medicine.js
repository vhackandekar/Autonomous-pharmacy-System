const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
    productId: { type: String },
    name: { type: String, required: true },
    pzn: { type: String },
    packageSize: { type: String },
    dosage: { type: String },
    unitType: { type: String }, // e.g., 'tablets', 'ml'
    description: { type: String },
    stock: { type: Number, required: true, default: 50, min: 0 },
    reorderLevel: { type: Number, default: 20 },
    lowStockNotified: { type: Boolean, default: false },
    price: { type: Number, required: true, default: 0 },
    costPrice: { type: Number, default: 0 },
    prescriptionRequired: { type: Boolean, default: false },
    isChronic: { type: Boolean, default: false }, // If true, prescription is reusable until expiry
}, { timestamps: true });

module.exports = mongoose.model('Medicine', medicineSchema);
