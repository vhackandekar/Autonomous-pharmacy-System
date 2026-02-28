const mongoose = require('mongoose');

const purchaseOrderSchema = new mongoose.Schema({
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    items: [{
        medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },
        quantity: { type: Number, required: true },
        costPrice: { type: Number, required: true }
    }],
    totalCost: { type: Number, required: true },
    status: {
        type: String,
        enum: ['Pending', 'Delivered', 'Cancelled'],
        default: 'Pending'
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Paid'],
        default: 'Pending'
    },
    orderDate: { type: Date, default: Date.now },
    deliveryDate: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
