const cron = require('node-cron');
const User = require('../schema/User');
const Prescription = require('../schema/Prescription');
const Notification = require('../schema/Notification');
const PredictiveRefillAgent = require('../Agents/PredictiveRefillAgent');

/**
 * Scheduled Jobs for Pharmacy System
 * This handles automatic daily tasks like refill analysis and database maintenance
 */
const initCronJobs = () => {
    console.log('🚀 [SYSTEM] Initializing Automated Clinical Intelligence...');

    // 1. DAILY REFILL ANALYSIS (Runs every day at 9:00 AM)
    // Predicts when users will run out of medication and sends proactive SMS/alerts
    cron.schedule('0 9 * * *', async () => {
        console.log('⏰ [SYSTEM] Running Automated Daily Refill Analysis...');
        try {
            const users = await User.find({ role: 'USER' });
            let count = 0;

            for (const user of users) {
                // Sequential processing to avoid database connection spikes
                await PredictiveRefillAgent.analyzeAndAlert(user._id);
                count++;
            }

            console.log(`✅ [SYSTEM] Daily Refill Analysis completed for ${count} users.`);
        } catch (error) {
            console.error('❌ [SYSTEM] Error during Automated Daily Refill Analysis:', error.message);
        }
    });

    // 2. DAILY PRESCRIPTION CLEANUP (Runs every day at 12:00 AM - Midnight)
    // Marks prescriptions that have passed their validity date as EXPIRED
    cron.schedule('0 0 * * *', async () => {
        console.log('⏰ [SYSTEM] Running Automated Daily Prescription Expiry Cleanup...');
        try {
            const now = new Date();
            const expired = await Prescription.find({
                validTill: { $lt: now },
                status: { $ne: 'EXPIRED' }
            }).populate('medicineId');

            for (const presc of expired) {
                presc.status = 'EXPIRED';
                await presc.save();

                // Notify user about expiry to encourage re-upload
                const notif = new Notification({
                    userId: presc.userId,
                    type: 'prescription',
                    message: `⚠️ Your prescription for ${presc.medicineId?.name || 'Medication'} has expired. Please upload a new one to continue ordering.`
                });
                await notif.save();

                if (global.io) {
                    global.io.to(String(notif.userId)).emit('notification', notif);
                    global.io.to(String(notif.userId)).emit('prescription_updated', presc);
                }
            }
            console.log(`✅ [SYSTEM] Marked ${expired.length} prescriptions as EXPIRED.`);
        } catch (error) {
            console.error('❌ [SYSTEM] Error during Prescription Cleanup:', error.message);
        }
    });

    // 3. DAILY INVENTORY AUDIT (Runs every day at 8:00 AM)
    // Alerts admins about items that dropped below reorder levels overnight
    cron.schedule('0 8 * * *', async () => {
        console.log('⏰ [SYSTEM] Running Morning Inventory Stock Audit...');
        try {
            const Medicine = require('../schema/Medicine');
            const lowStockItems = await Medicine.find({
                $expr: { $lt: ["$stock", "$reorderLevel"] }
            });

            if (lowStockItems.length > 0) {
                const adminNotif = new Notification({
                    recipientRole: 'ADMIN',
                    type: 'stock',
                    message: `⚠️ Morning Inventory Alert: ${lowStockItems.length} items are below critical reorder levels. Please review stock.`
                });
                await adminNotif.save();
                if (global.io) global.io.to('admin').emit('notification', adminNotif);
            }
            console.log(`✅ [SYSTEM] Inventory Audit completed. Found ${lowStockItems.length} low stock items.`);
        } catch (error) {
            console.error('❌ [SYSTEM] Inventory Audit failed:', error.message);
        }
    });

    // 4. SYSTEM HEARTBEAT (Every 1 Hour)
    cron.schedule('0 * * * *', () => {
        console.log('🛰️ [HEARTBEAT] Pharmacy Systems checking in... All cron threads ACTIVE.');
    });

    console.log('✅ All Automated Notification Systems are ACTIVE.');
};

module.exports = { initCronJobs };
