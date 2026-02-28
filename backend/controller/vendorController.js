const Vendor = require('../schema/Vendor');
const PurchaseOrder = require('../schema/PurchaseOrder');
const Medicine = require('../schema/Medicine');
const InventoryLog = require('../schema/InventoryLog');
const { sendEmail } = require('../utils/emailService');

exports.getVendors = async (req, res) => {
    try {
        const vendors = await Vendor.find().populate('medicines');
        res.json(vendors);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.addVendor = async (req, res) => {
    try {
        const vendor = new Vendor(req.body);
        await vendor.save();
        res.status(201).json(vendor);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateVendor = async (req, res) => {
    try {
        const vendor = await Vendor.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(vendor);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.deleteVendor = async (req, res) => {
    try {
        const vendor = await Vendor.findByIdAndDelete(req.params.id);
        if (!vendor) {
            return res.status(404).json({ error: 'Vendor not found' });
        }
        res.json({ message: 'Vendor deleted successfully' });
    } catch (error) {
        console.error(`Error deleting vendor ${req.params.id}:`, error);
        res.status(500).json({ error: error.message });
    }
};

exports.addMedicineToVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const { medicineIds } = req.body;
        console.log(`[VENDOR_MED_ADD] Vendor: ${id}, Meds:`, medicineIds);

        if (!medicineIds || !Array.isArray(medicineIds)) {
            return res.status(400).json({ error: 'medicineIds must be an array' });
        }

        const vendor = await Vendor.findById(id);
        if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

        const currentMeds = vendor.medicines || [];
        const newMedicines = [...new Set([...currentMeds.map(m => m.toString()), ...medicineIds])];
        vendor.medicines = newMedicines;
        await vendor.save();

        const updatedVendor = await Vendor.findById(id).populate('medicines');
        res.json(updatedVendor);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.removeMedicineFromVendor = async (req, res) => {
    try {
        const { id, medicineId } = req.params;
        const vendor = await Vendor.findById(id);
        if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

        const currentMeds = vendor.medicines || [];
        vendor.medicines = currentMeds.filter(m => m.toString() !== medicineId);
        await vendor.save();

        const updatedVendor = await Vendor.findById(id).populate('medicines');
        res.json(updatedVendor);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getVendorMedicines = async (req, res) => {
    try {
        const vendor = await Vendor.findById(req.params.id).populate('medicines');
        if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
        res.json(vendor.medicines);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createPurchaseOrder = async (req, res) => {
    try {
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
        res.status(201).json(po);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getPurchaseOrders = async (req, res) => {
    try {
        const orders = await PurchaseOrder.find({ status: { $ne: 'Cancelled' } }).populate('vendorId').populate('items.medicineId');
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.cancelPurchaseOrder = async (req, res) => {
    try {
        const po = await PurchaseOrder.findById(req.params.id).populate('vendorId');
        if (!po) return res.status(404).json({ error: 'Purchase Order not found' });
        if (po.status === 'Delivered') return res.status(400).json({ error: 'Cannot cancel a delivered order' });

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
        res.json({ message: 'Purchase order cancelled successfully', po });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.receivePurchaseOrder = async (req, res) => {
    try {
        const po = await PurchaseOrder.findById(req.params.id);
        if (!po) return res.status(404).json({ error: 'Purchase Order not found' });
        if (po.status === 'Delivered') return res.status(400).json({ error: 'Order already marked as delivered.' });
        if (po.status === 'Cancelled') return res.status(400).json({ error: 'Cannot receive a cancelled order.' });

        for (const item of po.items) {
            const medicine = await Medicine.findById(item.medicineId);
            if (medicine) {
                medicine.stock += item.quantity;
                medicine.lowStockNotified = false;
                await medicine.save();
                await new InventoryLog({ medicineId: item.medicineId, change: item.quantity, reason: 'RESTOCK' }).save();
            }
        }

        po.status = 'Delivered';
        po.deliveryDate = new Date();
        await po.save();
        res.json({ message: 'Purchase order received successfully.', po });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.generateAIDraftPO = async (req, res) => {
    try {
        const lowStockMedicines = await Medicine.find({
            $or: [{ $expr: { $lt: ["$stock", "$reorderLevel"] } }, { stock: { $lt: 20 } }]
        });

        if (lowStockMedicines.length === 0) return res.json({ message: "All inventory levels are optimal." });

        const vendors = await Vendor.find({ status: 'Active' }).populate('medicines');
        if (vendors.length === 0) return res.status(404).json({ error: "No active vendors found." });

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
            vendor: { _id: finalVendor.vendorId, name: finalVendor.name, email: finalVendor.email, leadTime: finalVendor.leadTime },
            items: finalItems,
            totalCost: finalItems.reduce((sum, item) => sum + (item.suggestedQuantity * item.costPrice), 0),
            allEvaluations: evaluations.map(e => ({
                name: e.name, matched: e.matchedCount, leadTime: e.leadTime, isBest: e.vendorId.toString() === finalVendor.vendorId.toString()
            })),
            reasoning: bestOption.matchedCount > 0 ? `${finalVendor.name} selected (highest coverage)` : `Defaulting to ${vendors[0].name}.`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
