const StockAlert = require('../schema/StockAlert');
const Medicine = require('../schema/Medicine');
const Notification = require('../schema/Notification');

exports.subscribeToAlert = async (req, res) => {
    try {
        const { medicineId } = req.body;
        const userId = req.user.id;

        if (!medicineId) {
            return res.status(400).json({ error: 'Medicine ID is required' });
        }

        // Check if medicine exists and is actually out of stock
        const medicine = await Medicine.findById(medicineId);
        if (!medicine) {
            return res.status(404).json({ error: 'Medicine not found' });
        }

        if (medicine.stock > 0) {
            return res.status(400).json({ error: `${medicine.name} is already in stock!` });
        }

        // Check if already subscribed for this medicine (un-notified version)
        const existing = await StockAlert.findOne({ userId, medicineId, notified: false });
        if (existing) {
            return res.status(400).json({ error: 'You are already subscribed to back-in-stock alerts for this medicine' });
        }

        const alert = new StockAlert({ userId, medicineId });
        await alert.save();

        res.status(201).json({
            message: `Subscribed successfully! We'll notify you when ${medicine.name} returns to stock.`
        });
    } catch (error) {
        console.error("[STOCK_ALERT_SUBSCRIBE_ERR]", error);
        res.status(500).json({ error: error.message });
    }
};

exports.notifyBackInStock = async (medicineId) => {
    try {
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

            // 3. Optional Email Support (Placeholder for scalability)
            // if (user.email) { sendEmail(user.email, "Medicine Back in Stock", msg); }

            // Mark alert as notified
            alert.notified = true;
            alert.notifiedAt = new Date();
            await alert.save();
        });

        await Promise.all(notificationPromises);

        return { success: true, count: alerts.length };
    } catch (error) {
        console.error("[STOCK_NOTIFY_ERR]", error);
        throw error;
    }
};
