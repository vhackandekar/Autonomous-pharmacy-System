const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    averageLeadTime: { type: Number, default: 3 }, // in days
    medicines: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Medicine' }],
}, { timestamps: true });

module.exports = mongoose.model('Vendor', vendorSchema);
