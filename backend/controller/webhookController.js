const Order = require('../schema/Order');
const Notification = require('../schema/Notification');
const ErrorHandler = require('../utils/ErrorHandler');
const asyncHandler = require('../utils/asyncHandler');

exports.orderFulfillment = asyncHandler(async (req, res, next) => {
    const { orderId, status, userId } = req.body;
    if (!orderId) return next(new ErrorHandler('Order ID is required', 400));

    console.log(`n8n Webhook: Updating Order ${orderId} and notifying Admin`);

    await Order.findByIdAndUpdate(orderId, { status: status });

    // CREATE ADMIN DASHBOARD ALERT
    await Notification.create({
        userId: userId || req.body.userId,
        recipientRole: 'ADMIN',
        type: 'order',
        message: `New Order Received! Order #${orderId} needs fulfillment.`
    });

    res.json({
        success: true,
        data: { message: `Status updated and Admin Alert created.` }
    });
});

exports.refillAlert = asyncHandler(async (req, res, next) => {
    const { type, medicineName, userId, daysLeft, stockLeft } = req.body;
    console.log(`n8n Webhook: ${type || 'REFILL'} Alert received for ${medicineName}`);

    if (type === 'STOCK_ALERT') {
        const notif = await Notification.create({
            userId: null,
            recipientRole: 'ADMIN',
            type: 'stock_alert',
            message: `URGENT: ${medicineName} is low on stock (${stockLeft} left).`
        });

        const populated = await Notification.findById(notif._id).populate('userId', 'name email phone');
        if (global.io) {
            global.io.to('admin').emit('refill_alert_admin', populated);
            if (userId) global.io.to(String(userId)).emit('refill_message', { message: populated.message, notification: populated });
        }
    } else {
        const notif = await Notification.create({
            userId: userId,
            recipientRole: 'ADMIN',
            type: 'refill',
            message: `Refill Recommendation: User running low on ${medicineName} (${daysLeft} days left).`
        });

        const populated = await Notification.findById(notif._id).populate('userId', 'name email phone');
        if (global.io) {
            global.io.to('admin').emit('refill_alert_admin', populated);
            if (userId) global.io.to(String(userId)).emit('refill_message', { message: populated.message, notification: populated });
        }
    }

    res.json({
        success: true,
        data: { message: "Admin Dashboard alerted." }
    });
});
