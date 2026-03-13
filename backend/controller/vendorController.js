const Vendor = require('../schema/Vendor');
const PurchaseOrder = require('../schema/PurchaseOrder');
const Medicine = require('../schema/Medicine');
const InventoryLog = require('../schema/InventoryLog');
const { sendEmail } = require('../utils/emailService');
const stockAlertController = require('./stockAlertController');
const ErrorHandler = require('../utils/ErrorHandler');
const asyncHandler = require('../utils/asyncHandler');

exports.getVendors = asyncHandler(async (req, res, next) => {
    const vendors = await Vendor.find().populate('medicines');
    res.json({
        success: true,
        data: { vendors }
    });
});

exports.addVendor = asyncHandler(async (req, res, next) => {
    const { name, email, phone, averageLeadTime } = req.body;

    if (!name || !name.trim()) return next(new ErrorHandler("Supplier name is required", 400));
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return next(new ErrorHandler("A valid email address is required", 400));
    if (!phone || phone.trim().length < 10) return next(new ErrorHandler("A valid phone number is required (min 10 digits)", 400));

    const leadTime = parseInt(averageLeadTime);
    if (isNaN(leadTime) || leadTime < 1) return next(new ErrorHandler("Lead time must be a positive number", 400));

    const existing = await Vendor.findOne({ $or: [{ name: name.trim() }, { email: email.trim() }] });
    if (existing) {
        return next(new ErrorHandler(
            existing.name.toLowerCase() === name.trim().toLowerCase()
                ? "A vendor with this name already exists"
                : "A vendor with this email already exists",
            400
        ));
    }

    const vendor = new Vendor({
        ...req.body,
        name: name.trim(),
        email: email.trim().toLowerCase()
    });
    await vendor.save();
    res.status(201).json({
        success: true,
        data: { vendor }
    });
});

exports.updateVendor = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const { name, email, averageLeadTime } = req.body;

    if (name && !name.trim()) return next(new ErrorHandler("Supplier name cannot be empty", 400));
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return next(new ErrorHandler("Invalid email format", 400));

    if (averageLeadTime) {
        const leadTime = parseInt(averageLeadTime);
        if (isNaN(leadTime) || leadTime < 1) return next(new ErrorHandler("Lead time must be at least 1 day", 400));
    }

    const vendor = await Vendor.findByIdAndUpdate(id, req.body, { new: true });
    if (!vendor) return next(new ErrorHandler("Vendor not found", 404));

    res.json({
        success: true,
        data: { vendor }
    });
});

exports.deleteVendor = asyncHandler(async (req, res, next) => {
    const vendor = await Vendor.findByIdAndDelete(req.params.id);
    if (!vendor) {
        return next(new ErrorHandler('Vendor not found', 404));
    }
    res.json({
        success: true,
        data: { message: 'Vendor deleted successfully' }
    });
});

exports.addMedicineToVendor = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const { medicineIds } = req.body;

    if (!medicineIds || !Array.isArray(medicineIds)) {
        return next(new ErrorHandler('medicineIds must be an array', 400));
    }

    const vendor = await Vendor.findById(id);
    if (!vendor) return next(new ErrorHandler('Vendor not found', 404));

    const currentMeds = vendor.medicines || [];
    const newMedicines = [...new Set([...currentMeds.map(m => m.toString()), ...medicineIds])];
    vendor.medicines = newMedicines;
    await vendor.save();

    const updatedVendor = await Vendor.findById(id).populate('medicines');
    res.json({
        success: true,
        data: { vendor: updatedVendor }
    });
});

exports.removeMedicineFromVendor = asyncHandler(async (req, res, next) => {
    const { id, medicineId } = req.params;
    const vendor = await Vendor.findById(id);
    if (!vendor) return next(new ErrorHandler('Vendor not found', 404));

    const currentMeds = vendor.medicines || [];
    vendor.medicines = currentMeds.filter(m => m.toString() !== medicineId);
    await vendor.save();

    const updatedVendor = await Vendor.findById(id).populate('medicines');
    res.json({
        success: true,
        data: { vendor: updatedVendor }
    });
});

exports.getVendorMedicines = asyncHandler(async (req, res, next) => {
    const vendor = await Vendor.findById(req.params.id).populate('medicines');
    if (!vendor) return next(new ErrorHandler('Vendor not found', 404));
    res.json({
        success: true,
        data: { medicines: vendor.medicines }
    });
});

exports.createPurchaseOrder = asyncHandler(async (req, res, next) => {
    const po = new PurchaseOrder(req.body);
    await po.save();

    const fullPO = await PurchaseOrder.findById(po._id)
        .populate('vendorId')
        .populate('items.medicineId');

    if (fullPO && fullPO.vendorId?.email) {
        let itemRows = '';
        fullPO.items.forEach(item => {
            itemRows += `
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.medicineId?.name || 'Unknown'}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.quantity}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">₹${item.costPrice}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">₹${(item.quantity * item.costPrice).toLocaleString()}</td>
                </tr>`;
        });

        const emailHtml = `
            <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 10px;">New Purchase Order: #${po._id.toString().slice(-6).toUpperCase()}</h2>
                <p>Dear <strong>${fullPO.vendorId.name}</strong>,</p>
                <p>Please find the following purchase order from <strong>Pharmacy Intelligence System</strong>. We request you to process these items for delivery.</p>
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <thead>
                        <tr style="background: #f9fafb; text-align: left;">
                            <th style="padding: 10px;">Product</th>
                            <th style="padding: 10px;">Qty</th>
                            <th style="padding: 10px;">Unit Price</th>
                            <th style="padding: 10px;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemRows}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3" style="padding: 10px; font-weight: bold; text-align: right;">Grand Total:</td>
                            <td style="padding: 10px; font-weight: bold; color: #4f46e5;">₹${fullPO.totalCost.toLocaleString()}</td>
                        </tr>
                    </tfoot>
                </table>
                <p style="font-size: 14px; color: #666;">This is an automated request. Please confirm receipt and estimated delivery time.</p>
            </div>
        `;
        await sendEmail(fullPO.vendorId.email, `Purchase Order Request - #${po._id.toString().slice(-6).toUpperCase()}`, emailHtml);
    }
    res.status(201).json({
        success: true,
        data: { po }
    });
});

exports.getPurchaseOrders = asyncHandler(async (req, res, next) => {
    const orders = await PurchaseOrder.find({ status: { $ne: 'Cancelled' } }).populate('vendorId').populate('items.medicineId');
    res.json({
        success: true,
        data: { orders }
    });
});

exports.cancelPurchaseOrder = asyncHandler(async (req, res, next) => {
    const po = await PurchaseOrder.findById(req.params.id).populate('vendorId');
    if (!po) return next(new ErrorHandler('Purchase Order not found', 404));
    if (po.status === 'Delivered') return next(new ErrorHandler('Cannot cancel a delivered order', 400));

    po.status = 'Cancelled';
    await po.save();

    if (po.vendorId?.email) {
        const emailHtml = `
            <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #ef4444; border-bottom: 2px solid #ef4444; padding-bottom: 10px;">Purchase Order Cancelled</h2>
                <p>Dear <strong>${po.vendorId.name}</strong>,</p>
                <p>This is to inform you that we have <strong>CANCELLED</strong> the following purchase order:</p>
                <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>PO ID:</strong> #${po._id.toString().slice(-6).toUpperCase()}</p>
                    <p><strong>Date:</strong> ${new Date(po.orderDate).toLocaleDateString()}</p>
                </div>
                <p>No further action is required.</p>
            </div>
        `;
        await sendEmail(po.vendorId.email, `Cancellation Alert: Purchase Order #${po._id.toString().slice(-6).toUpperCase()}`, emailHtml);
    }
    res.json({
        success: true,
        data: {
            message: 'Purchase order cancelled successfully',
            po
        }
    });
});

exports.receivePurchaseOrder = asyncHandler(async (req, res, next) => {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return next(new ErrorHandler('Purchase Order not found', 404));
    if (po.status === 'Delivered') return next(new ErrorHandler('Order already marked as delivered.', 400));
    if (po.status === 'Cancelled') return next(new ErrorHandler('Cannot receive a cancelled order.', 400));

    for (const item of po.items) {
        const medicine = await Medicine.findById(item.medicineId);
        if (medicine) {
            const oldStock = medicine.stock;
            medicine.stock += item.quantity;
            medicine.lowStockNotified = false;
            await medicine.save();
            await new InventoryLog({ medicineId: item.medicineId, change: item.quantity, reason: 'RESTOCK' }).save();

            if (oldStock === 0 && medicine.stock > 0) {
                await stockAlertController.notifyBackInStock(medicine._id);
            }
        }
    }

    po.status = 'Delivered';
    po.deliveryDate = new Date();
    await po.save();
    res.json({
        success: true,
        data: {
            message: 'Purchase order received successfully.',
            po
        }
    });
});

exports.generateAIDraftPO = asyncHandler(async (req, res, next) => {
    const lowStockMedicines = await Medicine.find({
        $or: [{ $expr: { $lt: ["$stock", "$reorderLevel"] } }, { stock: { $lt: 20 } }]
    });

    if (lowStockMedicines.length === 0) return res.json({ success: true, message: "All inventory levels are optimal." });

    const vendors = await Vendor.find({ status: 'Active' }).populate('medicines');
    if (vendors.length === 0) return next(new ErrorHandler("No active vendors found.", 404));

    const itemsToRestock = lowStockMedicines.map(m => ({
        medicineId: m._id, name: m.name, currentStock: m.stock, reorderLevel: m.reorderLevel, costPrice: m.costPrice || 0
    }));

    const evaluations = vendors.map(v => {
        const vendorMedIds = v.medicines.map(m => m._id.toString());
        const matchedItems = itemsToRestock.filter(item => vendorMedIds.includes(item.medicineId.toString()));
        return {
            vendorId: v._id,
            name: v.name,
            email: v.email,
            leadTime: v.averageLeadTime || 3,
            matchedCount: matchedItems.length,
            matchedItems: matchedItems.map(item => ({
                ...item, suggestedQuantity: (item.reorderLevel * 3) - item.currentStock || item.reorderLevel
            }))
        };
    });

    evaluations.sort((a, b) => b.matchedCount - a.matchedCount || a.leadTime - b.leadTime);
    const bestOption = evaluations[0];
    let finalVendor = bestOption, finalItems = bestOption.matchedItems;

    if (bestOption.matchedCount === 0) {
        finalVendor = { vendorId: vendors[0]._id, name: vendors[0].name, email: vendors[0].email, leadTime: vendors[0].averageLeadTime };
        finalItems = itemsToRestock.map(item => ({ ...item, suggestedQuantity: (item.reorderLevel * 3) - item.currentStock || item.reorderLevel }));
    }

    res.json({
        success: true,
        data: {
            vendor: { _id: finalVendor.vendorId, name: finalVendor.name, email: finalVendor.email, leadTime: finalVendor.leadTime },
            items: finalItems,
            totalCost: finalItems.reduce((sum, item) => sum + (item.suggestedQuantity * item.costPrice), 0),
            allEvaluations: evaluations.map(e => ({
                name: e.name, matched: e.matchedCount, leadTime: e.leadTime, isBest: e.vendorId.toString() === finalVendor.vendorId.toString()
            })),
            reasoning: bestOption.matchedCount > 0 ? `${finalVendor.name} selected (highest coverage)` : `Defaulting to ${vendors[0].name}.`
        }
    });
});
