const Order = require('../schema/Order');
const Cart = require('../schema/Cart');
const Medicine = require('../schema/Medicine');
const Notification = require('../schema/Notification');
const Prescription = require('../schema/Prescription');
const OrderPlacementAgent = require('../Agents/OrderPlacementAgent');
const PredictiveRefillAgent = require('../Agents/PredictiveRefillAgent');

exports.placeOrder = async (req, res) => {
    try {
        const { userId, items, totalAmount, cartId, paymentMethod } = req.body;

        // Security Check: Ensure user only places order for themselves
        if (req.user.role !== 'ADMIN' && req.user.id !== userId) {
            return res.status(403).json({ error: 'Access denied. You can only place orders for yourself.' });
        }

        if (!userId || !items || items.length === 0) {
            return res.status(400).json({ error: 'userId and items are required' });
        }

        // 0. Preliminary Stock & Prescription Check
        for (const item of items) {
            const med = await Medicine.findById(item.medicineId);
            if (!med) return res.status(404).json({ error: `Medicine not found` });

            // Stock check
            if (med.stock < item.quantity) {
                return res.status(400).json({ error: `Insufficient stock for ${med.name}` });
            }

            // Prescription check
            if (med.prescriptionRequired) {
                const presc = await Prescription.findOne({ userId, medicineId: item.medicineId });

                if (!presc) {
                    return res.status(403).json({
                        error: `Prescription required for ${med.name}. Please upload your prescription first.`,
                        requiresPrescription: true,
                        medicineId: item.medicineId,
                        status: 'MISSING'
                    });
                }

                if (presc.status === 'REJECTED') {
                    return res.status(403).json({
                        error: `Your prescription for ${med.name} was rejected. Please upload a clear valid copy.`,
                        requiresPrescription: true,
                        medicineId: item.medicineId,
                        status: 'REJECTED'
                    });
                }

                if (presc.status === 'PENDING') {
                    return res.status(403).json({
                        error: `Your prescription for ${med.name} is currently being verified by our AI. Please wait a moment.`,
                        requiresPrescription: true,
                        medicineId: item.medicineId,
                        status: 'PENDING'
                    });
                }

                if (presc.validTill < new Date()) {
                    return res.status(403).json({
                        error: `Your prescription for ${med.name} has expired. Please upload a new one.`,
                        requiresPrescription: true,
                        medicineId: item.medicineId,
                        status: 'EXPIRED'
                    });
                }
            }
        }

        let orderItems = items;
        let finalAmount = totalAmount;

        // 1. Resolve Items if cartId is provided
        if (cartId) {
            const cart = await Cart.findById(cartId).populate('items.medicineId');
            if (cart) {
                orderItems = cart.items.map(item => ({
                    medicineId: item.medicineId._id,
                    quantity: item.quantity,
                    dosagePerDay: "As directed"
                }));
                finalAmount = cart.items.reduce((sum, item) => sum + (item.medicineId.price * item.quantity), 0);
            }
        }

        // 2. Create Order 
        const order = new Order({
            userId,
            items: orderItems,
            totalAmount: finalAmount || totalAmount || 0,
            status: 'PENDING',
            paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Paid',
            paymentMethod: paymentMethod || 'COD'
        });

        await order.save();

        // 3. Mark cart as completed
        if (cartId) {
            await Cart.findByIdAndUpdate(cartId, { status: 'COMPLETED' });
        } else {
            await Cart.findOneAndUpdate(
                { userId, status: 'PENDING' },
                { $set: { status: 'COMPLETED' } }
            );
        }

        // 4. Save an admin notification and emit real-time event
        try {
            const adminNotif = new Notification({ recipientRole: 'ADMIN', type: 'order', message: `New order placed: ${order._id}` });
            await adminNotif.save();
            if (global.io) global.io.to('admin').emit('order_created', order);
        } catch (e) { console.error('notif/socket error', e); }

        // 5. Trigger Agent Fulfillment (Handles stock, prediction, and notifications)
        try {
            await OrderPlacementAgent.finalizeOrder(order._id);
        } catch (e) { console.error('Agent finalization error', e); }

        // 6. Run predictive refill analysis immediately
        PredictiveRefillAgent.analyzeAndAlert(userId).catch(err => console.error('predictive analyze error', err));

        res.status(201).json(order);
    } catch (error) {
        console.error("Manual Order Placement Error:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.getHistory = async (req, res) => {
    try {
        const targetUserId = req.params.userId;

        // Security Check: Ensure user only views their own history
        if (req.user.role !== 'ADMIN' && req.user.id !== targetUserId) {
            return res.status(403).json({ error: 'Access denied. You can only view your own order history.' });
        }

        const orders = await Order.find({ userId: targetUserId }).populate('items.medicineId').sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).populate('items.medicineId');
        if (!order) return res.status(404).json({ error: 'Order not found' });

        // Security Check: Only the owner or an admin can view details
        if (req.user.role !== 'ADMIN' && req.user.id !== order.userId.toString()) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        res.json(order);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.cancelOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ error: 'Order not found' });

        // Security Check
        if (req.user.id !== order.userId.toString() && req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Access denied.' });
        }

        // Can only cancel if PENDING or PROCESSING?
        // Let's allow cancelling if not SHIPPED or DELIVERED for now
        if (['SHIPPED', 'DELIVERED'].includes(order.status)) {
            return res.status(400).json({ error: 'Cannot cancel an order that is already shipped or delivered.' });
        }

        if (order.status === 'CANCELLED') {
            return res.status(400).json({ error: 'Order is already cancelled.' });
        }

        // Revert stock
        for (const item of order.items) {
            await Medicine.findByIdAndUpdate(item.medicineId, {
                $inc: { stock: item.quantity }
            });
        }

        order.status = 'CANCELLED';
        await order.save();

        res.json({ message: 'Order cancelled successfully', order });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
