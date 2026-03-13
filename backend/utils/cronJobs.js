const cron = require('node-cron');
const User = require('../schema/User');
const PredictiveRefillAgent = require('../Agents/PredictiveRefillAgent');

/**
 * Scheduled Jobs for Pharmacy System
 * This handles automatic daily tasks like refill analysis
 */
const initCronJobs = () => {
    console.log('🚀 [SYSTEM] Initializing Automated Clinical Intelligence...');

    // 1. DAILY REFILL ANALYSIS (Runs every day at 6:47 AM)
    cron.schedule('47 6 * * *', async () => {
        console.log('⏰ [SYSTEM] Running Automated Daily Refill Analysis...');
        try {
            const users = await User.find({ role: 'USER' });
            let count = 0;

            for (const user of users) {
                await PredictiveRefillAgent.analyzeAndAlert(user._id);
                count++;
            }

            console.log(`✅ [TEST CRON] Daily Refill Analysis completed for ${count} users.`);
        } catch (error) {
            console.error('❌ [TEST CRON] Error during Automated Daily Refill Analysis:', error.message);
        }
    });

    // 2. DAILY PRESCRIPTION CLEANUP (Runs every day at 12:00 AM)
    cron.schedule('0 0 * * *', async () => {
        console.log('⏰ [SYSTEM] Running Automated Daily Prescription Expiry Cleanup...');
        try {
            const Prescription = require('../schema/Prescription');
            const Notification = require('../schema/Notification');

            const now = new Date();
            const expired = await Prescription.find({
                validTill: { $lt: now },
                status: { $ne: 'EXPIRED' }
            }).populate('medicineId');

            for (const presc of expired) {
                presc.status = 'EXPIRED';
                await presc.save();

                // Notify user
                const notif = new Notification({
                    userId: presc.userId,
                    type: 'prescription',
                    message: `⚠️ Your prescription for ${presc.medicineId.name} has expired. Please upload a new one to continue ordering.`
                });
                await notif.save();

                if (global.io) {
                    global.io.to(String(presc.userId)).emit('notification', notif);
                    global.io.to(String(presc.userId)).emit('prescription_updated', presc);
                }
            }
            console.log(`✅ [CRON] Marked ${expired.length} prescriptions as EXPIRED.`);
        } catch (error) {
            console.error('❌ [CRON] Error during Prescription Cleanup:', error.message);
        }
    });

    // 3. HEARTBEAT (Every 1 minute for status verification)
    cron.schedule('* * * * *', () => {
        console.log('� [HEARTBEAT] Pharmacy Systems checking in... All cron threads ACTIVE.');
    });

    console.log('✅ All Automated Notification Systems are ACTIVE.');
};

module.exports = { initCronJobs };
