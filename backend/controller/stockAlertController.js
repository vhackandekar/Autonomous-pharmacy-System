const StockAlert = require('../schema/StockAlert');
const Medicine = require('../schema/Medicine');
const Notification = require('../schema/Notification');
const ErrorHandler = require('../utils/ErrorHandler');
const asyncHandler = require('../utils/asyncHandler');

exports.subscribeToAlert = asyncHandler(async (req, res, next) => {
    const { medicineId } = req.body;
    const userId = req.user.id;

    if (!medicineId) {
        return next(new ErrorHandler('Medicine ID is required', 400));
    }

    // Check if medicine exists and is actually out of stock
    const medicine = await Medicine.findById(medicineId);
    if (!medicine) {
        return next(new ErrorHandler('Medicine not found', 404));
    }

    if (medicine.stock > 0) {
        return next(new ErrorHandler(`${medicine.name} is already in stock!`, 400));
    }

    // Check if already subscribed for this medicine (un-notified version)
    const existing = await StockAlert.findOne({ userId, medicineId, notified: false });
    if (existing) {
        return next(new ErrorHandler('You are already subscribed to back-in-stock alerts for this medicine', 400));
    }

    const alert = new StockAlert({ userId, medicineId });
    await alert.save();

    res.status(201).json({
        success: true,
        data: { message: `Subscribed successfully! We'll notify you when ${medicine.name} returns to stock.` }
    });
});

exports.notifyBackInStock = async (medicineId) => {
    const medicine = await Medicine.findById(medicineId);
    if (!medicine || medicine.stock <= 0) return;

    const alerts = await StockAlert.find({
        medicineId: medicine._id,
        notified: false
    });

    if (alerts.length === 0) return;

    console.log(`[STOCK_NOTIFY] Notifying ${alerts.length} users for ${medicine.name}`);

    const notificationPromises = alerts.map(async (alert) => {
        const msg = `Good news! ${medicine.name} is back in stock. Now you can proceed with the order. Click here to chat with Dr. Saahil.`;

        // 1. In-app notification
        const notif = new Notification({
            userId: alert.userId,
            recipientRole: 'USER',
            type: 'medicine_available',
            message: msg,
            medicineId: medicine._id
        });
        await notif.save();

        // 2. Real-time push via Socket.IO
        if (global.io) {
            global.io.to(String(alert.userId)).emit('notification', notif);
            global.io.to(String(alert.userId)).emit('back_in_stock', {
                message: msg,
                medicineId: medicine._id,
                medicineName: medicine.name
            });
        }

        // Mark alert as notified
        alert.notified = true;
        alert.notifiedAt = new Date();
        await alert.save();
    });

    await Promise.all(notificationPromises);
    return { success: true, count: alerts.length };
};
