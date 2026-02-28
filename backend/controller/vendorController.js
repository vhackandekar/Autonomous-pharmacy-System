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
        res.status(500).json({ error: error.message });
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
        console.error(`Error deleting vendor ${req.params.id}:`, error); // Better error logging
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

        // Ensure medicines array exists
        const currentMeds = vendor.medicines || [];

        // Add only unique IDs
        const newMedicines = [...new Set([...currentMeds.map(m => m.toString()), ...medicineIds])];
        vendor.medicines = newMedicines;
        await vendor.save();

        const updatedVendor = await Vendor.findById(id).populate('medicines');
        console.log(`[VENDOR_MED_ADD_SUCCESS] Vendor ${id} updated.`);
        res.json(updatedVendor);
    } catch (error) {
        console.error(`[VENDOR_MED_ADD_ERROR]`, error);
        res.status(500).json({ error: error.message });
    }
};

exports.removeMedicineFromVendor = async (req, res) => {
    try {
        const { id, medicineId } = req.params;
        console.log(`[VENDOR_MED_REMOVE] Vendor: ${id}, Med: ${medicineId}`);

        const vendor = await Vendor.findById(id);
        if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

        const currentMeds = vendor.medicines || [];
        vendor.medicines = currentMeds.filter(m => m.toString() !== medicineId);
        await vendor.save();

        const updatedVendor = await Vendor.findById(id).populate('medicines');
        console.log(`[VENDOR_MED_REMOVE_SUCCESS] Vendor ${id} updated.`);
        res.json(updatedVendor);
    } catch (error) {
        console.error(`[VENDOR_MED_REMOVE_ERROR]`, error);
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

        // Fetch full data for email
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

            await sendEmail(
                fullPO.vendorId.email,
                `Purchase Order Request - #${po._id.toString().slice(-6).toUpperCase()}`,
                emailHtml
            );
        }

        res.status(201).json(po);
    } catch (error) {
        console.error('Error creating purchase order:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getPurchaseOrders = async (req, res) => {
    try {
        const orders = await PurchaseOrder.find({ status: { $ne: 'Cancelled' } }).populate('vendorId').populate('items.medicineId');
        res.json(orders);
    } catch (error) {
        console.error('Error fetching purchase orders:', error); // Better error logging
        res.status(500).json({ error: error.message });
    }
};

exports.cancelPurchaseOrder = async (req, res) => {
    try {
        const po = await PurchaseOrder.findById(req.params.id).populate('vendorId');
        if (!po) return res.status(404).json({ error: 'Purchase Order not found' });

        if (po.status === 'Delivered') {
            return res.status(400).json({ error: 'Cannot cancel a delivered order' });
        }

        po.status = 'Cancelled';
        await po.save();
        console.log(`✅ Purchase Order #${req.params.id} cancelled successfully`);

        // Send cancellation email to vendor
        if (po.vendorId?.email) {
            console.log(`✉️ Sending cancellation email to ${po.vendorId.email}`);
            const emailHtml = `
                <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h2 style="color: #ef4444; border-bottom: 2px solid #ef4444; padding-bottom: 10px; display: inline-block;">Purchase Order Cancelled</h2>
                    </div>
                    <p>Dear <strong>${po.vendorId.name}</strong>,</p>
                    <p>This is to inform you that we have <strong>CANCELLED</strong> the following purchase order:</p>
                    <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0;"><strong>PO ID:</strong> #${po._id.toString().slice(-6).toUpperCase()}</p>
                        <p style="margin: 5px 0 0 0;"><strong>Date:</strong> ${new Date(po.orderDate).toLocaleDateString()}</p>
                    </div>
                    <p>No further action is required for this order. We apologize for any inconvenience caused.</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #666; text-align: center;">This is an automated notification from the Pharmacy Intelligence System.</p>
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

        if (po.status === 'Delivered') {
            return res.status(400).json({ error: 'Order already marked as received/delivered.' });
        }
        if (po.status === 'Cancelled') {
            return res.status(400).json({ error: 'Cannot receive a cancelled order.' });
        }

        // 1. Update Inventory for each item
        for (const item of po.items) {
            const medicine = await Medicine.findById(item.medicineId);
            if (medicine) {
                medicine.stock += item.quantity;
                medicine.lowStockNotified = false; // Reset low stock alert
                await medicine.save();

                // Log the inventory replenishment
                await new InventoryLog({
                    medicineId: item.medicineId,
                    change: item.quantity,
                    reason: 'RESTOCK'
                }).save();

                console.log(`[INVENTORY_UPDATE] Added ${item.quantity} units to ${medicine.name}. New Stock: ${medicine.stock}`);
            }
        }

        // 2. Mark PO as Delivered
        po.status = 'Delivered';
        po.deliveryDate = new Date();
        await po.save();

        res.json({ message: 'Purchase order received successfully. Inventory has been updated.', po });
    } catch (error) {
        console.error('[RECEIVE_PO_ERROR]', error);
        res.status(500).json({ error: error.message });
    }
};

exports.generateAIDraftPO = async (req, res) => {
    try {
        // Find medicines below reorder level (using simple find first)
        const lowStockMedicines = await Medicine.find({
            $or: [
                { $expr: { $lt: ["$stock", "$reorderLevel"] } },
                { stock: { $lt: 20 } } // Fallback for meds with very low defaults
            ]
        });

        if (lowStockMedicines.length === 0) {
            return res.json({
                message: "All inventory levels are optimal. No restocking required.",
            });
        }

        // Find all active vendors with their medicine lists
        const vendors = await Vendor.find({ status: 'Active' }).populate('medicines');

        if (vendors.length === 0) {
            return res.status(404).json({ error: "No active vendors found. Please register a vendor first." });
        }

        // Map low stock medicines
        const itemsToRestock = lowStockMedicines.map(m => ({
            medicineId: m._id,
            name: m.name,
            currentStock: m.stock,
            reorderLevel: m.reorderLevel,
            costPrice: m.costPrice || 0
        }));

        // Evaluate all vendors
        const evaluations = vendors.map(v => {
            const vendorMedIds = v.medicines.map(m => m._id.toString());
            const matchedItems = itemsToRestock.filter(item => vendorMedIds.includes(item.medicineId.toString()));
            return {
                vendorId: v._id,
                name: v.name,
                email: v.email,
                leadTime: v.averageLeadTime || 3,
                matchedCount: matchedItems.length,
                matchedItems: matchedItems.map(item => {
                    const refillTarget = item.reorderLevel * 3;
                    const suggestedQty = refillTarget - item.currentStock;
                    return {
                        ...item,
                        suggestedQuantity: suggestedQty > 0 ? suggestedQty : item.reorderLevel
                    };
                })
            };
        });

        // Sort: Primary by most items matched, secondary by shortest lead time
        evaluations.sort((a, b) => b.matchedCount - a.matchedCount || a.leadTime - b.leadTime);

        const bestOption = evaluations[0];

        // If no matches found across any vendor, fallback to first vendor and assume they can supply items
        // (This handles cases where products aren't yet mapped to vendors)
        let finalVendor = bestOption;
        let finalItems = bestOption.matchedItems;

        if (bestOption.matchedCount === 0) {
            finalVendor = {
                vendorId: vendors[0]._id,
                name: vendors[0].name,
                email: vendors[0].email,
                leadTime: vendors[0].averageLeadTime
            };
            finalItems = itemsToRestock.map(item => {
                const refillTarget = item.reorderLevel * 3;
                const suggestedQty = refillTarget - item.currentStock;
                return {
                    ...item,
                    suggestedQuantity: suggestedQty > 0 ? suggestedQty : item.reorderLevel
                };
            });
        }

        const totalCost = finalItems.reduce((sum, item) => sum + (item.suggestedQuantity * item.costPrice), 0);

        res.json({
            success: true,
            vendor: {
                _id: finalVendor.vendorId,
                name: finalVendor.name,
                email: finalVendor.email,
                leadTime: finalVendor.leadTime
            },
            items: finalItems,
            totalCost,
            allEvaluations: evaluations.map(e => ({
                name: e.name,
                matched: e.matchedCount,
                leadTime: e.leadTime,
                isBest: e.vendorId.toString() === finalVendor.vendorId.toString()
            })),
            reasoning: bestOption.matchedCount > 0
                ? `${finalVendor.name} was selected because they provide the highest coverage (${finalVendor.matchedCount}/${itemsToRestock.length} items) with a lead time of ${finalVendor.leadTime} days.`
                : `No specific vendor matches found for these items. Defaulting to ${vendors[0].name}. Recommend mapping products to vendors for better intelligence.`
        });

    } catch (error) {
        console.error('Draft PO Error Details:', error);
        res.status(500).json({ error: `Draft Failed: ${error.message}` });
    }
};
