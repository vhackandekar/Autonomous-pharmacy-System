const Order = require('../schema/Order');
const Medicine = require('../schema/Medicine');
const InventoryLog = require('../schema/InventoryLog');
const User = require('../schema/User');
const Notification = require('../schema/Notification');
const Prescription = require('../schema/Prescription');
const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Groq = require("groq-sdk");

const langfuse = require('../utils/langfuseClient');

class OrderPlacementAgent {
    constructor() {
        if (process.env.GEMINI_API_KEY) {
            this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            this.geminiModel = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" }, { apiVersion: "v1" });
        }
        if (process.env.GROQ_API_KEY) {
            this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        }
        this.langfuse = langfuse;
    }

    async processOrder(userId, items, providedTotalAmount, parentTrace = null, sessionId = null) {
        const trace = parentTrace || (this.langfuse ? this.langfuse.trace({
            name: "order-placement-process",
            userId: userId.toString(),
            sessionId: sessionId || "untracked-session",
            metadata: { itemsCount: items.length }
        }) : null);

        try {
            let totalAmount = 0;
            const itemsWithPrices = [];

            for (const item of items) {
                const medicine = await Medicine.findById(item.medicineId);
                // 1. Stock check
                if (!medicine || medicine.stock < (item.quantity || 1)) {
                    throw new Error(`Insufficient stock for ${medicine?.name || 'requested medicine'}`);
                }

                // --- RESERVE STOCK IMMEDIATELY ---
                medicine.stock -= (item.quantity || 1);
                medicine.lowStockNotified = false; // Reset so they get notified again if it dips
                await medicine.save();

                // Log Inventory Change
                await new InventoryLog({
                    medicineId: medicine._id,
                    change: -(item.quantity || 1),
                    reason: 'ORDER_PLACED_VIA_AGENT'
                }).save();

                // 2. Prescription check
                if (medicine.prescriptionRequired) {
                    const presc = await Prescription.findOne({
                        userId,
                        medicineId: item.medicineId,
                        status: { $in: ['VERIFIED', 'PENDING_ADMIN_REVIEW'] },
                        validTill: { $gt: new Date() },
                        $or: [
                            { isReusable: true },
                            { isUsed: false }
                        ]
                    });

                    if (!presc) {
                        // REVERT STOCK if prescription fails (though it should have been caught by SafetyAgent)
                        medicine.stock += (item.quantity || 1);
                        await medicine.save();
                        throw new Error(`A verified prescription is required for ${medicine.name}. Please upload one and wait for verification.`);
                    }
                }

                const price = medicine.price || 0;
                const cost = price * (item.quantity || 1);
                totalAmount += cost;

                itemsWithPrices.push({
                    medicineId: item.medicineId,
                    medicineName: medicine.name,
                    quantity: item.quantity || 1,
                    dosagePerDay: item.dosage || "As prescribed",
                    price: price
                });
            }

            const finalTotal = providedTotalAmount || totalAmount;

            // --- CALCULATE ESTIMATED END DATE VIA AI ---
            let estimatedEndDate = null;
            const prompt = `Based on the following items and current date (${new Date().toISOString()}), predict the single date when the USER will completely finish ALL these medications. Return ONLY the ISO date string.
            Items: ${JSON.stringify(itemsWithPrices)}`;

            // --- LANGFUSE GENERATION ---
            const generation = trace ? trace.generation({
                name: "EndDatePrediction",
                model: this.groq ? "llama-3.3-70b-versatile" : "gemini-2.0-flash",
                input: prompt
            }) : null;

            // Choice 1: Groq
            if (this.groq) {
                try {
                    const chatCompletion = await this.groq.chat.completions.create({
                        messages: [{ role: "user", content: prompt }],
                        model: "llama-3.3-70b-versatile",
                    });
                    estimatedEndDate = new Date(chatCompletion.choices[0].message.content.trim());
                } catch (e) {
                    console.error("Groq End Date Prediction Failed (Primary):", e.message);
                    if (e.status === 429) {
                        try {
                            console.log("Using Groq Fallback (Llama 3.1 8b) for End Date...");
                            const fallbackComp = await this.groq.chat.completions.create({
                                messages: [{ role: "user", content: prompt }],
                                model: "llama-3.1-8b-instant",
                            });
                            estimatedEndDate = new Date(fallbackComp.choices[0].message.content.trim());
                        } catch (fallbackErr) {
                            console.error("Groq Fallback Failed:", fallbackErr.message);
                        }
                    }
                }
            }

            // Choice 2: Gemini (Fallback)
            if (!estimatedEndDate && this.geminiModel) {
                try {
                    const result = await this.geminiModel.generateContent(prompt);
                    estimatedEndDate = new Date(result.response.text().trim());
                } catch (e) {
                    console.error("Gemini End Date Prediction Failed:", e.message);
                }
            }

            // Fallback: Default 30 days
            if (!estimatedEndDate || isNaN(estimatedEndDate.getTime())) {
                estimatedEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            }

            if (generation) {
                generation.end({ output: estimatedEndDate.toISOString() });
            }

            const newOrder = new Order({
                userId,
                items: itemsWithPrices,
                totalAmount: finalTotal,
                status: 'PENDING',
                paymentStatus: 'Pending',
                paymentMethod: 'AI Assistant',
                estimatedEndDate: estimatedEndDate
            });

            const savedOrder = await newOrder.save();

            const user = await User.findById(userId);
            if (process.env.N8N_ORDER_WEBHOOK_URL) {
                axios.post(process.env.N8N_ORDER_WEBHOOK_URL, {
                    orderId: savedOrder._id,
                    userId,
                    phone: user?.phone,
                    status: 'FULFILLMENT_REQUESTED'
                }).catch(err => console.error("n8n Trigger Failed:", err.message));
            }

            // Create notification in DB
            const notif = await new Notification({
                userId,
                type: 'order',
                message: `Your order for ${itemsWithPrices.map(i => i.medicineName).join(', ')} has been confirmed! Order ID: ${savedOrder._id}`
            }).save();

            // --- REAL-TIME NOTIFICATION ---
            if (global.io) {
                // To User
                global.io.to(String(userId)).emit('notification', notif);
                // To Admin (About new order)
                global.io.to('admin').emit('order_created', savedOrder);
            }

            if (trace) await this.langfuse.flushAsync();
            return { success: true, orderId: savedOrder._id, order: savedOrder, message: "Order placed successfully." };
        } catch (error) {
            if (trace) {
                trace.update({ statusMessage: error.message, metadata: { error: true } });
                await this.langfuse.flushAsync();
            }
            console.error("OrderPlacementAgent Error:", error);
            return { success: false, error: error.message };
        }
    }

    async finalizeOrder(orderId, parentTrace = null, sessionId = null) {
        const trace = parentTrace || (this.langfuse ? this.langfuse.trace({
            name: "order-finalization",
            userId: orderId.toString(), // Usually order IDs aren't user IDs but good fallback
            sessionId: sessionId || "untracked-session",
            metadata: { orderId: orderId.toString() }
        }) : null);

        try {
            const order = await Order.findById(orderId).populate('items.medicineId');
            if (!order) throw new Error("Order not found");

            // 1. AI PREDICTION: Estimated End Date
            const prompt = `Based on these medications and current date (${new Date().toISOString()}), 
            predict the SINGLE date when the user will run out of ALL these items. 
            Return ONLY the ISO date string.
            Items: ${JSON.stringify(order.items)}`;

            const generation = trace ? trace.generation({
                name: "FinalEndDatePrediction",
                model: this.groq ? "llama-3.3-70b-versatile" : "gemini-2.0-flash",
                input: prompt
            }) : null;

            let estimatedEndDate = null;
            if (this.groq) {
                try {
                    const comp = await this.groq.chat.completions.create({
                        messages: [{ role: "user", content: prompt }],
                        model: "llama-3.3-70b-versatile",
                    });
                    estimatedEndDate = new Date(comp.choices[0].message.content.trim());
                } catch (e) {
                    console.error("Groq Finalize Prediction Failed (Primary):", e);
                    if (e.status === 429) {
                        try {
                            console.log("Using Groq Fallback (Llama 3.1 8b) for Finalization...");
                            const fallbackComp = await this.groq.chat.completions.create({
                                messages: [{ role: "user", content: prompt }],
                                model: "llama-3.1-8b-instant",
                            });
                            estimatedEndDate = new Date(fallbackComp.choices[0].message.content.trim());
                        } catch (fallbackErr) {
                            console.error("Groq Finalize Fallback Failed:", fallbackErr.message);
                        }
                    }
                }
            }

            if (!estimatedEndDate && this.geminiModel) {
                try {
                    const result = await this.geminiModel.generateContent(prompt);
                    estimatedEndDate = new Date(result.response.text().trim());
                } catch (e) { console.error("Gemini Finalize Prediction Failed:", e); }
            }

            if (!estimatedEndDate || isNaN(estimatedEndDate.getTime())) {
                estimatedEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            }

            if (generation) generation.end({ output: estimatedEndDate.toISOString() });

            // 2. UPDATE ORDER, STOCK & PRESCRIPTION USAGE
            order.estimatedEndDate = estimatedEndDate;
            // order.status = 'PENDING'; // Redundant. Already set in controller
            await order.save();

            for (const item of order.items) {
                // Update Prescription Usage (Acute medicines)
                const med = await Medicine.findById(item.medicineId._id);
                if (med && med.prescriptionRequired) {
                    const presc = await Prescription.findOne({
                        userId: order.userId,
                        medicineId: med._id,
                        status: { $in: ['VERIFIED', 'PENDING_ADMIN_REVIEW'] },
                        validTill: { $gt: new Date() }
                    }).sort({ createdAt: -1 });

                    if (presc) {
                        presc.usedCount += 1;
                        if (!presc.isReusable) {
                            presc.isUsed = true; // Mark as spent if acute
                        }
                        await presc.save();
                    }
                }
            }

            // 3. TRIGGER N8N FULFILLMENT WEBHOOK
            const user = await User.findById(order.userId);
            if (process.env.N8N_ORDER_WEBHOOK_URL) {
                axios.post(process.env.N8N_ORDER_WEBHOOK_URL, {
                    orderId: order._id,
                    userId: order.userId,
                    phone: user.phone,
                    status: 'FULFILLMENT_REQUESTED'
                }).catch(err => console.error("n8n Order Trigger Failed:", err.message));
            }

            // 4. NOTIFICATIONS & POST-ORDER ANALYSIS
            const medicineNames = order.items.map(i => i.medicineId.name).join(', ');

            // Trigger Predictive Refill Analysis immediately to update their health dashboard
            const PredictiveRefillAgent = require('./PredictiveRefillAgent');
            await PredictiveRefillAgent.analyzeAndAlert(order.userId, trace, sessionId);

            // For User
            await new Notification({
                userId: order.userId,
                type: 'order',
                message: `Your order for ${medicineNames} has been confirmed! Predicted end date: ${estimatedEndDate.toDateString()}.`
            }).save();

            // For Admin
            await new Notification({
                recipientRole: 'ADMIN',
                type: 'order',
                message: `New Paid Order! Order #${order._id.toString().slice(-6)} for ${medicineNames} (User: ${user.name}) requires fulfillment.`
            }).save();

            if (trace) await this.langfuse.flushAsync();
            return { success: true };
        } catch (error) {
            if (trace) {
                trace.update({ statusMessage: error.message, metadata: { error: true } });
                await this.langfuse.flushAsync();
            }
            console.error("finalizeOrder Error:", error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new OrderPlacementAgent();
