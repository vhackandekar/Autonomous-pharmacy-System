const Order = require('../schema/Order');
const Cart = require('../schema/Cart');
const Medicine = require('../schema/Medicine');
const User = require('../schema/User');
const Notification = require('../schema/Notification');
const Prescription = require('../schema/Prescription');
const InventoryLog = require('../schema/InventoryLog');
const OrderPlacementAgent = require('../Agents/OrderPlacementAgent');
const PredictiveRefillAgent = require('../Agents/PredictiveRefillAgent');
const { checkLowStockAndNotify } = require('../utils/inventoryUtility');
const ErrorHandler = require('../utils/ErrorHandler');
const asyncHandler = require('../utils/asyncHandler');

exports.placeOrder = asyncHandler(async (req, res, next) => {
    const { userId, items, totalAmount, cartId, paymentMethod } = req.body;

    // Security Check: Ensure user only places order for themselves
    if (req.user.role !== 'ADMIN' && req.user.id !== userId) {
        return next(new ErrorHandler('Access denied. You can only place orders for yourself.', 403));
    }

    if (!userId || !items || items.length === 0) {
        return next(new ErrorHandler('userId and items are required', 400));
    }

    // 0. Preliminary Stock & Prescription Check
    for (const item of items) {
        const med = await Medicine.findById(item.medicineId);
        if (!med) return next(new ErrorHandler(`Medicine not found`, 404));

        // Stock check
        if (med.stock < item.quantity) {
            return next(new ErrorHandler(`Insufficient stock for ${med.name}`, 400));
        }

        // Prescription check
        if (med.prescriptionRequired) {
            const presc = await Prescription.findOne({ userId, medicineId: item.medicineId });

            if (!presc) {
                return res.status(403).json({
                    success: false,
                    error: `Prescription required for ${med.name}. Please upload your prescription first.`,
                    requiresPrescription: true,
                    medicineId: item.medicineId,
                    status: 'MISSING'
                });
            }

            if (presc.status === 'REJECTED') {
                return res.status(403).json({
                    success: false,
                    error: `Your prescription for ${med.name} was rejected. Please upload a clear valid copy.`,
                    requiresPrescription: true,
                    medicineId: item.medicineId,
                    status: 'REJECTED'
                });
            }

            if (presc.status === 'PENDING') {
                return res.status(403).json({
                    success: false,
                    error: `Your prescription for ${med.name} is currently being verified by our AI. Please wait a moment.`,
                    requiresPrescription: true,
                    medicineId: item.medicineId,
                    status: 'PENDING'
                });
            }

            if (presc.validTill < new Date()) {
                return res.status(403).json({
                    success: false,
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

    // 2b. Deduct stock before saving order (RESERVATION)
    for (const item of orderItems) {
        const med = await Medicine.findByIdAndUpdate(item.medicineId, {
            $inc: { stock: -item.quantity }
        }, { new: true });

        await new InventoryLog({
            medicineId: item.medicineId,
            change: -item.quantity,
            reason: 'MANUAL_ORDER_PLACED'
        }).save();

        if (med) {
            await checkLowStockAndNotify(med, global.io);
        }
    }

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

    // 4. Save notifications
    const adminNotif = new Notification({ recipientRole: 'ADMIN', type: 'order', message: `New order placed: ${order._id}` });
    await adminNotif.save();
    if (global.io) global.io.to('admin').emit('order_created', order);

    const userObj = await User.findById(userId);
    if (userObj && userObj.orderUpdates !== false) {
        const userNotif = new Notification({
            userId,
            type: 'order',
            message: `Your order #${order._id.toString().slice(-6).toUpperCase()} has been placed successfully!`
        });
        await userNotif.save();
        if (global.io) global.io.to(String(userId)).emit('notification', userNotif);
    }

    // 5. Trigger Agent Fulfillment
    OrderPlacementAgent.finalizeOrder(order._id).catch(err => console.error('Agent finalization error', err));

    // 6. Run predictive refill analysis immediately
    PredictiveRefillAgent.analyzeAndAlert(userId).catch(err => console.error('predictive analyze error', err));

    res.status(201).json({
        success: true,
        data: {
            message: "Order placed successfully",
            order
        }
    });
});

exports.getHistory = asyncHandler(async (req, res, next) => {
    const targetUserId = req.params.userId;

    // Security Check: Ensure user only views their own history
    if (req.user.role !== 'ADMIN' && req.user.id !== targetUserId) {
        return next(new ErrorHandler('Access denied. You can only view your own order history.', 403));
    }

    const orders = await Order.find({ userId: targetUserId }).populate('items.medicineId').sort({ createdAt: -1 });
    res.json({
        success: true,
        data: { orders }
    });
});

exports.getOrderById = asyncHandler(async (req, res, next) => {
    const order = await Order.findById(req.params.id).populate('items.medicineId').populate('userId', 'name email phone address1 address2 city state pin');
    if (!order) return next(new ErrorHandler('Order not found', 404));

    // Security Check: Only the owner or an admin can view details
    const orderOwnerId = order.userId._id ? order.userId._id.toString() : order.userId.toString();
    if (req.user.role !== 'ADMIN' && req.user.id !== orderOwnerId) {
        return next(new ErrorHandler('Access denied. You can only view your own order details.', 403));
    }

    res.json({
        success: true,
        data: { order }
    });
});

exports.cancelOrder = asyncHandler(async (req, res, next) => {
    const order = await Order.findById(req.params.id);
    if (!order) return next(new ErrorHandler('Order not found', 404));

    // Security Check
    if (req.user.id !== order.userId.toString() && req.user.role !== 'ADMIN') {
        return next(new ErrorHandler('Access denied.', 403));
    }

    if (order.status === 'DELIVERED' || order.status === 'OUT_FOR_DELIVERY') {
        return next(new ErrorHandler('Cannot cancel an order that is already shipped or delivered.', 400));
    }

    if (order.status === 'CANCELLED') {
        return next(new ErrorHandler('Order is already cancelled.', 400));
    }

    // RESTORE STOCK ON CANCELLATION
    for (const item of order.items) {
        await Medicine.findByIdAndUpdate(item.medicineId, {
            $inc: { stock: item.quantity },
            lowStockNotified: false
        });
        await new InventoryLog({
            medicineId: item.medicineId,
            change: item.quantity,
            reason: 'ORDER_CANCELLED'
        }).save();
    }

    order.status = 'CANCELLED';
    await order.save();

    // ADMIN NOTIFICATION (Always ON)
    const adminNotif = await new Notification({
        recipientRole: 'ADMIN',
        type: 'order_cancelled',
        message: `⚠️ Order Cancelled: Order #${order._id.toString().slice(-6).toUpperCase()} has been cancelled by the user.`
    }).save();

    if (global.io) {
        global.io.to('admin').emit('notification', adminNotif);
        global.io.to('admin').emit('order_updated_admin', order);
    }

    // USER NOTIFICATION (Respect Preference)
    const userObj = await User.findById(order.userId);
    if (userObj && userObj.orderUpdates !== false) {
        const userNotif = await new Notification({
            userId: order.userId,
            type: 'order_cancelled',
            message: `Your order #${order._id.toString().slice(-6).toUpperCase()} has been cancelled.`
        }).save();
        if (global.io) global.io.to(String(order.userId)).emit('notification', userNotif);
    }

    res.json({
        success: true,
        data: {
            message: 'Order cancelled successfully',
            order
        }
    });
});
