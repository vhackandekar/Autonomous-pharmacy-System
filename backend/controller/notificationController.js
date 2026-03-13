const Notification = require('../schema/Notification');

exports.sendRefillNotification = async (req, res) => {
    try {
        const { userId, message } = req.body;
        if (!userId || !message) {
            return res.status(400).json({ error: 'userId and message are required' });
        }
        const notification = new Notification({ userId, type: 'refill', message });
        await notification.save();
        try {
            const NotificationModel = require('../schema/Notification');
            const populated = await NotificationModel.findById(notification._id).populate('userId', 'name email phone');
            if (global.io) {
                // Admin-facing alert listing customers
                global.io.to('admin').emit('refill_alert_admin', populated);
                // Send a direct message event to the user with the refill message
                if (userId) global.io.to(String(userId)).emit('refill_message', { message: populated.message, notification: populated });
            }
        } catch (e) { console.error('socket emit error', e); }
        res.status(201).json(notification);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.getUserNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({
            userId: req.params.userId,
            recipientRole: 'USER'
        }).sort({ sentAt: -1 }).limit(20);
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getAdminNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({
            recipientRole: 'ADMIN'
        }).sort({ sentAt: -1 }).limit(50);
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.markAsRead = async (req, res) => {
    try {
        const notification = await Notification.findByIdAndUpdate(
            req.params.id,
            { isRead: true },
            { new: true }
        );
        res.json(notification);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.markAllAsRead = async (req, res) => {
    try {
        const { userId, role } = req.body;
        const query = role === 'ADMIN' ? { recipientRole: 'ADMIN' } : { userId, recipientRole: 'USER' };
        await Notification.updateMany(query, { isRead: true });
        res.json({ message: "All notifications marked as read" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
