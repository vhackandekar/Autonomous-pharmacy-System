const Notification = require('../schema/Notification');
const ErrorHandler = require('../utils/ErrorHandler');
const asyncHandler = require('../utils/asyncHandler');

exports.sendRefillNotification = asyncHandler(async (req, res, next) => {
    const { userId, message } = req.body;
    if (!userId || !message) {
        return next(new ErrorHandler('userId and message are required', 400));
    }
    const notification = new Notification({ userId, type: 'refill', message });
    await notification.save();

    const populated = await Notification.findById(notification._id).populate('userId', 'name email phone');
    if (global.io) {
        // Admin-facing alert listing customers
        global.io.to('admin').emit('refill_alert_admin', populated);
        // Send a direct message event to the user with the refill message
        if (userId) {
            global.io.to(String(userId)).emit('refill_message', { message: populated.message, notification: populated });
        }
    }

    res.status(201).json({
        success: true,
        data: { notification }
    });
});

exports.getUserNotifications = asyncHandler(async (req, res, next) => {
    const notifications = await Notification.find({
        userId: req.params.userId,
        recipientRole: 'USER'
    }).sort({ sentAt: -1 }).limit(20);

    res.json({
        success: true,
        data: { notifications }
    });
});

exports.getAdminNotifications = asyncHandler(async (req, res, next) => {
    const notifications = await Notification.find({
        recipientRole: 'ADMIN'
    }).sort({ sentAt: -1 }).limit(50);

    res.json({
        success: true,
        data: { notifications }
    });
});

exports.markAsRead = asyncHandler(async (req, res, next) => {
    const notification = await Notification.findByIdAndUpdate(
        req.params.id,
        { isRead: true },
        { new: true }
    );

    if (!notification) {
        return next(new ErrorHandler("Notification not found", 404));
    }

    res.json({
        success: true,
        data: { notification }
    });
});

exports.markAllAsRead = asyncHandler(async (req, res, next) => {
    const { userId, role } = req.body;
    const query = role === 'ADMIN' ? { recipientRole: 'ADMIN' } : { userId, recipientRole: 'USER' };
    await Notification.updateMany(query, { isRead: true });

    res.json({
        success: true,
        data: { message: "All notifications marked as read" }
    });
});
