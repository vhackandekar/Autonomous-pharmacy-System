const mongoose = require('mongoose');
const axios = require('axios');
const Order = require('../schema/Order');
const Medicine = require('../schema/Medicine');
const RefillAlert = require('../schema/RefillAlert');
const User = require('../schema/User');
const Notification = require('../schema/Notification');

class PredictiveRefillAgent {
    async analyzeAndAlert(userId) {
        try {
            console.log(`[PredictiveRefillAgent] 🔎 Analyzing User: ${userId}`);

            // Find orders for the user
            let history = await Order.find({ userId });

            if (!history || history.length === 0) {
                console.log(`[PredictiveRefillAgent] ❌ No orders found for user ${userId}`);
                return [];
            }

            // FIX #5: Sort by date (newest first)
            history.sort((a, b) => new Date(b.orderDate || b.createdAt) - new Date(a.orderDate || a.createdAt));

            console.log(`[PredictiveRefillAgent] 📜 Found ${history.length} orders. Calculating consumption...`);

            const predictions = [];
            const processedMedicines = new Set(); // FIX #1: Track to dedupe
            const now = new Date();

            for (const order of history) {
                // Must be DELIVERED or SHIPPED
                if (order.status !== 'DELIVERED' && order.status !== 'SHIPPED') continue;

                for (const item of order.items) {
                    const medId = String(item.medicineId?._id || item.medicineId);
                    
                    // FIX #1: Skip if we already processed this medicine (kept newest)
                    if (processedMedicines.has(medId)) {
                        console.log(`[PredictiveRefillAgent] ⏭️  Skipping duplicate medicine ${medId}, already have newest order`);
                        continue;
                    }

                    // Manual fetch for medicine to avoid population issues
                    const medicine = await Medicine.findById(medId);
                    const medicineName = medicine ? medicine.name : 'Medication';

                    const orderDate = new Date(order.orderDate || order.createdAt);
                    const diffMs = now - orderDate;
                    const daysPassed = Math.floor(diffMs / (1000 * 60 * 60 * 24));

                    // FIX #4: Parse dosage properly - extract both quantity AND frequency
                    let unitsPerDay = 1;
                    const dosageStr = String(item.dosagePerDay || '');
                    
                    // Pattern: "2 tablets" or "2 tablets 3 times daily" or "3 tablets BD"
                    const quantityMatch = dosageStr.match(/(\d+)\s*(tablet|ml|dose|unit)/i);
                    const frequencyMatch = dosageStr.match(/(\d+)\s*times?\s*(?:a\s*)?day|BD|BID|TID|QID|QD/i);
                    
                    let quantity = quantityMatch ? parseInt(quantityMatch[1], 10) : 1;
                    let frequency = 1;
                    
                    if (frequencyMatch) {
                        const freq = frequencyMatch[1] || frequencyMatch[0];
                        if (freq === 'BD' || freq === 'BID') frequency = 2;
                        else if (freq === 'TID') frequency = 3;
                        else if (freq === 'QID') frequency = 4;
                        else if (freq === 'QD') frequency = 1;
                        else frequency = parseInt(freq, 10) || 1;
                    }
                    
                    unitsPerDay = quantity * frequency;
                    console.log(`[PredictiveRefillAgent] 📋 ${medicineName}: dosageStr="${dosageStr}" → ${quantity} × ${frequency} = ${unitsPerDay} units/day`);

                    const totalConsumable = item.quantity;
                    const consumed = daysPassed * unitsPerDay;
                    const remaining = totalConsumable - consumed;
                    
                    // FIX #3: Track both daysLeft AND isOverdue
                    let daysLeft = 0;
                    let isOverdue = false;
                    
                    if (remaining > 0) {
                        daysLeft = Math.round(remaining / unitsPerDay);
                    } else {
                        daysLeft = 0;
                        isOverdue = true; // FIX #3: Flag overdue
                    }

                    // Calculate the exact predicted refill date
                    const refillDate = new Date(now.getTime() + (daysLeft * 24 * 60 * 60 * 1000));

                    console.log(`[PredictiveRefillAgent] -> ${medicineName}: Stock=${totalConsumable}, Consumption=${consumed}, DaysPassed=${daysPassed}, Predicted DaysLeft=${daysLeft}, Overdue=${isOverdue}, RefillDate=${refillDate.toDateString()}`);

                    predictions.push({
                        medicineId: medId,
                        medicineName,
                        daysLeft,
                        isOverdue, // FIX #3
                        refillDate: refillDate.toISOString(),
                        predictionReason: `Calculated from Q=${totalConsumable} minus consumed=${consumed} (${unitsPerDay} units/day)`
                    });

                    // FIX #1: Mark this medicine as processed
                    processedMedicines.add(medId);
                }
            }

            // Notification Trigger Logic
            const userObj = await User.findById(userId);

            // FIX #6: Dedupe alert triggers - group by medicineId
            const medicineMap = new Map();
            for (const pred of predictions) {
                if (!medicineMap.has(pred.medicineId) || pred.daysLeft < medicineMap.get(pred.medicineId).daysLeft) {
                    medicineMap.set(pred.medicineId, pred);
                }
            }

            for (const [medId, pred] of medicineMap) {
                const existingAlert = await RefillAlert.findOne({ userId, medicineId: medId });

                // FIX #2: Reset notified flag when daysLeft > 5 (user refilled)
                if (existingAlert && existingAlert.notified && pred.daysLeft > 5) {
                    console.log(`[PredictiveRefillAgent] 🔄 Resetting alert for ${pred.medicineName} (user refilled, daysLeft=${pred.daysLeft})`);
                    await RefillAlert.findOneAndUpdate(
                        { userId, medicineId: medId },
                        { notified: false, daysLeft: pred.daysLeft }
                    );
                    continue; // Don't send alert
                }

                // Skip if already notified (within same cycle)
                if (existingAlert && existingAlert.notified) {
                    console.log(`[PredictiveRefillAgent] 🔕 Alert already sent for ${pred.medicineName}, skipping.`);
                    continue;
                }

                // Trigger alert if <= 5 days OR already overdue
                if (pred.daysLeft <= 5 || pred.isOverdue) {
                    console.log(`[PredictiveRefillAgent] 🚨 TRIGGERING REFILL ALERT for ${pred.medicineName} (DaysLeft=${pred.daysLeft}, Overdue=${pred.isOverdue})`);

                    await RefillAlert.findOneAndUpdate(
                        { userId, medicineId: medId },
                        { daysLeft: pred.daysLeft, notified: true, isOverdue: pred.isOverdue }, // FIX #3
                        { upsert: true }
                    );

                    // Webhook Trigger
                    const webhookUrl = process.env.N8N_REFILL_WEBHOOK_URL;
                    if (webhookUrl) {
                        console.log(`[PredictiveRefillAgent] 🌐 Sending n8n webhook...`);
                        axios.post(webhookUrl, {
                            userId: userId.toString(),
                            phone: userObj?.phone || 'N/A',
                            medicineName: pred.medicineName,
                            daysLeft: pred.daysLeft,
                            isOverdue: pred.isOverdue,
                            predictedRefillDate: pred.refillDate
                        }).then(() => console.log(`[PredictiveRefillAgent] ✅ Webhook sent for ${pred.medicineName}`))
                            .catch(err => console.error(`[PredictiveRefillAgent] ❌ Webhook failed: ${err.message}`));
                    }

                    // Notification save
                    const urgency = pred.isOverdue ? "⚠️ URGENT - " : "";
                    const notif = await new Notification({
                        userId,
                        type: 'refill',
                        message: `${urgency}Reminder: You will run out of ${pred.medicineName} in about ${pred.daysLeft} days. Refill now!`
                    }).save();

                    // Real-time push
                    if (global.io) {
                        global.io.to('admin').emit('refill_alert_admin', { ...notif.toObject(), userId: userObj });
                        global.io.to(String(userId)).emit('refill_message', { message: notif.message, notification: notif });
                    }
                }
            }

            return Array.from(medicineMap.values());
        } catch (error) {
            console.error("PredictiveRefillAgent Critical Failure:", error);
            return [];
        }
    }
}

module.exports = new PredictiveRefillAgent();
