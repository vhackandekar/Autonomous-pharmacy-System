const mongoose = require('mongoose');
const axios = require('axios');
const Order = require('../schema/Order');
const Medicine = require('../schema/Medicine');
const RefillAlert = require('../schema/RefillAlert');
const User = require('../schema/User');
const Notification = require('../schema/Notification');

const langfuse = require('../utils/langfuseClient');

class PredictiveRefillAgent {
    async analyzeAndAlert(userId) {
        let trace;
        if (langfuse) {
            trace = langfuse.trace({
                name: 'refill-prediction-analysis',
                userId: String(userId),
                metadata: { userId: String(userId) }
            });
        }

        try {
            console.log(`[PredictiveRefillAgent] 🔎 Analyzing User: ${userId}`);

            // Find orders for the user
            let history = await Order.find({ userId });
            console.log(`[PredictiveRefillAgent] Found ${history?.length || 0} orders for user ${userId}`);

            if (!history || history.length === 0) {
                console.log(`[PredictiveRefillAgent] ❌ No orders found for user ${userId}`);
                if (trace) trace.update({ output: "No orders found" });
                return [];
            }

            history.sort((a, b) => new Date(b.orderDate || b.createdAt) - new Date(a.orderDate || a.createdAt));

            const predictions = [];
            const processedMedicines = new Set();
            const now = new Date();

            for (const order of history) {
                if (order.status !== 'DELIVERED') continue;

                for (const item of order.items) {
                    const medId = String(item.medicineId?._id || item.medicineId);

                    if (processedMedicines.has(medId)) continue;

                    const medicine = await Medicine.findById(medId);
                    const medicineName = medicine ? medicine.name : 'Medication';

                    let span;
                    if (trace) {
                        span = trace.span({
                            name: `predict-${medicineName}`,
                            input: { dosage: item.dosagePerDay, quantity: item.quantity, orderDate: order.orderDate || order.createdAt }
                        });
                    }

                    const orderDate = new Date(order.orderDate || order.createdAt);
                    const diffMs = now - orderDate;
                    const daysPassed = Math.floor(diffMs / (1000 * 60 * 60 * 24));

                    let unitsPerDay = 1;
                    const dosageStr = String(item.dosagePerDay || '');

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

                    const totalConsumable = item.quantity;
                    const consumed = daysPassed * unitsPerDay;
                    const remaining = totalConsumable - consumed;

                    let daysLeft = 0;
                    let isOverdue = false;

                    if (remaining > 0) {
                        daysLeft = Math.round(remaining / unitsPerDay);
                    } else {
                        daysLeft = 0;
                        isOverdue = true;
                    }

                    const refillDate = new Date(now.getTime() + (daysLeft * 24 * 60 * 60 * 1000));

                    const prediction = {
                        medicineId: medId,
                        medicineName,
                        daysLeft,
                        isOverdue,
                        refillDate: refillDate.toISOString(),
                        predictionReason: `Calculated from Q=${totalConsumable} minus consumed=${consumed} (${unitsPerDay} units/day)`
                    };

                    predictions.push(prediction);

                    if (span) {
                        span.end({
                            output: prediction
                        });
                    }

                    processedMedicines.add(medId);
                }
            }

            const userObj = await User.findById(userId);
            const medicineMap = new Map();
            for (const pred of predictions) {
                if (!medicineMap.has(pred.medicineId) || pred.daysLeft < medicineMap.get(pred.medicineId).daysLeft) {
                    medicineMap.set(pred.medicineId, pred);
                }
            }

            for (const [medId, pred] of medicineMap) {
                const existingAlert = await RefillAlert.findOne({ userId, medicineId: medId });

                if (existingAlert && existingAlert.notified && pred.daysLeft > 2) {
                    await RefillAlert.findOneAndUpdate(
                        { userId, medicineId: medId },
                        { notified: false, daysLeft: pred.daysLeft }
                    );
                    continue;
                }

                if (existingAlert && existingAlert.notified) continue;

                console.log(`[PredictiveRefillAgent] Checking alert for ${pred.medicineName}: ${pred.daysLeft} days left, overdue: ${pred.isOverdue}`);

                if (pred.daysLeft <= 2 || pred.isOverdue) {
                    const medicine = await Medicine.findById(medId);
                    const isChronic = medicine?.isChronic || false;
                    const isBPorSugar = medicine?.name?.toLowerCase().match(/bp|sugar|diabet|hyper|blood pressure/i);

                    await RefillAlert.findOneAndUpdate(
                        { userId, medicineId: medId },
                        { daysLeft: pred.daysLeft, notified: true, isOverdue: pred.isOverdue },
                        { upsert: true }
                    );

                    // Respect User Preference: Stop notifications if refillAlerts is disabled
                    if (userObj && userObj.refillAlerts === false) {
                        console.log(`[PredictiveRefillAgent] Skipping notification for ${userObj.name} (Refill Alerts Disabled)`);
                        continue;
                    }

                    const webhookUrl = process.env.N8N_REFILL_WEBHOOK_URL;
                    if (webhookUrl) {
                        console.log(`[PredictiveRefillAgent] 🚀 Triggering n8n Refill Webhook for ${pred.medicineName}...`);
                        axios.post(webhookUrl, {
                            userId: userId.toString(),
                            phone: userObj?.phone || 'N/A',
                            medicineName: pred.medicineName,
                            daysLeft: pred.daysLeft,
                            isOverdue: pred.isOverdue,
                            predictedRefillDate: pred.refillDate
                        })
                            .then(() => console.log(`[PredictiveRefillAgent] ✅ Webhook Triggered Successfully for ${pred.medicineName}`))
                            .catch(err => console.error(`[PredictiveRefillAgent] Webhook failed for ${pred.medicineName}: ${err.message}`));
                    }

                    const personalizedHeader = isBPorSugar ? "🩺 Vital Health Reminder: " : (isChronic ? "💊 Regular Refill Alert: " : "");
                    const urgency = pred.isOverdue ? "⚠️ URGENT - " : personalizedHeader;

                    const notif = await new Notification({
                        userId,
                        type: 'refill',
                        message: `${urgency}You have ${pred.daysLeft} days of ${pred.medicineName} left. Based on your history, it's time to refill!`
                    }).save();

                    const adminNotif = await new Notification({
                        userId,
                        recipientRole: 'ADMIN',
                        type: 'refill',
                        message: `Urgent Refill Required: ${userObj?.name} is running low on ${pred.medicineName} (${pred.daysLeft} days left).`
                    }).save();

                    if (global.io) {
                        global.io.to('admin').emit('refill_alert_admin', { ...adminNotif.toObject(), userId: userObj });
                        global.io.to(String(userId)).emit('notification', notif);
                        global.io.to(String(userId)).emit('refill_message', { message: notif.message, notification: notif });
                    }
                }
            }

            const finalPredictions = Array.from(medicineMap.values());
            if (trace) trace.update({ output: finalPredictions });
            return finalPredictions;
        } catch (error) {
            console.error("PredictiveRefillAgent Critical Failure:", error);
            if (trace) trace.update({ output: error.message, level: "ERROR" });
            return [];
        } finally {
            if (trace) {
                // Langfuse node client needs a bit of time to flush if it doesn't have an explicit flush
                // But we don't want to block the whole app. The client usually handles background sending.
            }
        }
    }
}

module.exports = new PredictiveRefillAgent();
