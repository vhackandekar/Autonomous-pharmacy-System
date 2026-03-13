const Notification = require('../schema/Notification');

/**
 * Checks if a medicine's stock has fallen below its reorder level and notifies the admin if necessary.
 * @param {Object} medicine - The medicine document object.
 * @param {Object} io - Global socket.io instance.
 */
exports.checkLowStockAndNotify = async (medicine, io) => {
    try {
        const threshold = medicine.reorderLevel || 20;

        if (medicine.stock < threshold && !medicine.lowStockNotified) {
            console.log(`[INVENTORY] Low stock detected for ${medicine.name} (${medicine.stock} left). Notifying admin...`);

            const adminNotif = new Notification({
                recipientRole: 'ADMIN',
                type: 'stock_alert',
                message: `⚠️ Inventory Alert: ${medicine.name} is running low (${medicine.stock} units left). Threshold: ${threshold}.`
            });
            await adminNotif.save();

            if (io) {
                io.to('admin').emit('notification', adminNotif);
                io.to('admin').emit('stock_alert', adminNotif);
            }

            // Mark as notified to prevent spamming
            medicine.lowStockNotified = true;
            await medicine.save();
            return true;
        }

        // Reset notification flag if stock is restored above threshold
        if (medicine.stock >= threshold && medicine.lowStockNotified) {
            medicine.lowStockNotified = false;
            await medicine.save();
        }

        return false;
    } catch (error) {
        console.error('[INVENTORY_UTILITY_ERR]', error);
        return false;
    }
};
