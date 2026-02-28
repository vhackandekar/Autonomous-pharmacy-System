const { GoogleGenerativeAI } = require("@google/generative-ai");
const Groq = require("groq-sdk");
const Order = require('../schema/Order');
const RefillAlert = require('../schema/RefillAlert');
const User = require('../schema/User');
const Notification = require('../schema/Notification');
const axios = require('axios');

const langfuse = require('../utils/langfuseClient');

class PredictiveRefillAgent {
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

    async analyzeAndAlert(userId, parentTrace = null, sessionId = null) {
        // --- LANGFUSE TRACE START ---
        const trace = parentTrace || (this.langfuse ? this.langfuse.trace({
            name: "predictive-refill-analysis",
            userId: userId.toString(),
            sessionId: sessionId || "untracked-session"
        }) : null);

        try {
            const Prescription = require('../schema/Prescription');
            const history = await Order.find({ userId }).populate('items.medicineId');
            const prescriptions = await Prescription.find({ userId, status: 'VERIFIED' });

            if (!history || history.length === 0) return { message: "No history to analyze." };

            const prompt = `
        # SYSTEM ROLE
        You are an Expert Pharmacometrician Agent. Your task is to calculate the exactly "Days Left" for each medication based on clinical consumption rules.

        # DATA CONTEXT
        - Current Date: ${new Date().toISOString()}
        - Medication History: ${JSON.stringify(history)}
        - VERIFIED Prescriptions (for dosage reference): ${JSON.stringify(prescriptions.map(p => ({ medicine: p.medicineId, dosage: p.extractedData?.dosage, frequency: p.extractedData?.frequency })))}

        # CALCULATION PROTOCOL (STRICT ADHERENCE REQUIRED)
        1. For each medicine, find the MOST RECENT FULFILLED order.
        2. Extract Quantity (Q) and Dosage (D).
        3. IF a matching medicine exists in 'VERIFIED Prescriptions', prioritize the 'frequency' and 'dosage' from the prescription over the order history defaults.
        4. Parse Dosage into units/day:
           - "QD" or "Once a day" = 1
           - "BID" or "Twice a day" = 2
           - "TID" or "Thrice a day" = 3
           - "QID" = 4
           - If dosage contains a number like "2 tablets", assume that is per intake, multiplied by frequency. If frequency is missing, assume once a day (1 dose = 2 units).
        4. Calculate Consumption (C): (Days passed since OrderDate) * (Units per day).
        5. Calculated Residual (R): Quantity - Consumption.
        6. Days Left (DL): R / (Units per day).
        7. If Days Left < 0, return 0.

        # OUTPUT FORMAT (STRICT JSON ARRAY)
        Return ONLY a JSON array: [{"medicineId": "string", "medicineName": "string", "daysLeft": number, "predictionReason": "Calculation based on [Q] units - [C] units consumed"}]
      `;

            // --- LANGFUSE GENERATION START ---
            const generation = trace ? trace.generation({
                name: "PredictiveRefillAgent",
                model: this.groq ? "llama-3.3-70b-versatile" : "gemini-2.0-flash",
                input: prompt
            }) : null;

            let predictions = null;

            // Choice 1: Groq
            if (this.groq) {
                try {
                    const chatCompletion = await this.groq.chat.completions.create({
                        messages: [{ role: "user", content: prompt }],
                        model: "llama-3.3-70b-versatile",
                        response_format: { type: "json_object" }
                    });
                    const content = JSON.parse(chatCompletion.choices[0].message.content);
                    predictions = content.predictions || content; // Handle varying JSON structures
                } catch (e) {
                    console.error("Groq Refill Prediction Failed (Primary):", e.message);
                    if (e.status === 429) {
                        try {
                            console.log("Using Groq Fallback (Llama 3.1 8b) for Refill Analysis...");
                            const fallbackComp = await this.groq.chat.completions.create({
                                messages: [{ role: "user", content: prompt }],
                                model: "llama-3.1-8b-instant",
                                response_format: { type: "json_object" }
                            });
                            const content = JSON.parse(fallbackComp.choices[0].message.content);
                            predictions = content.predictions || content;
                        } catch (fallbackErr) {
                            console.error("Groq Refill Fallback Failed:", fallbackErr.message);
                        }
                    }
                }
            }

            // Choice 2: Gemini
            if (!predictions && this.geminiModel) {
                try {
                    const result = await this.geminiModel.generateContent(prompt);
                    let text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
                    const content = JSON.parse(text);
                    predictions = content.predictions || content;
                } catch (e) {
                    console.error("Gemini Refill Prediction Failed:", e.message);
                }
            }

            if (generation) {
                generation.end({
                    output: JSON.stringify(predictions)
                });
            }

            if (!predictions || !Array.isArray(predictions)) {
                if (trace) await this.langfuse.flushAsync();
                return [];
            }

            const user = await User.findById(userId);
            for (const pred of predictions) {
                if (pred.daysLeft <= 5) {
                    const existingAlert = await RefillAlert.findOne({ userId, medicineId: pred.medicineId });

                    if (existingAlert && existingAlert.notified) {
                        continue; // Skip if already notified
                    }

                    await RefillAlert.findOneAndUpdate(
                        { userId, medicineId: pred.medicineId },
                        { daysLeft: pred.daysLeft, notified: true },
                        { upsert: true, returnDocument: 'after' }
                    );

                    if (process.env.N8N_REFILL_WEBHOOK_URL) {
                        axios.post(process.env.N8N_REFILL_WEBHOOK_URL, {
                            userId: userId,
                            phone: user.phone,
                            medicineName: pred.medicineName,
                            daysLeft: pred.daysLeft
                        }, { timeout: 15000 }).catch(err => console.error("n8n Refill Trigger Failed:", err.message));
                    }

                    // Create notification in DB and emit via socket so UI updates in real-time
                    try {
                        const notif = await new Notification({
                            userId,
                            type: 'refill',
                            message: `Reminder: You will run out of ${pred.medicineName} in about ${pred.daysLeft} days. Don't forget to refill!`
                        }).save();

                        if (global.io) {
                            try {
                                // Populate user info so admin sees customer details
                                const NotificationModel = require('../schema/Notification');
                                const populated = await NotificationModel.findById(notif._id).populate('userId', 'name email phone');
                                // Send only admin-facing refill alert (list of customers)
                                global.io.to('admin').emit('refill_alert_admin', populated);
                                // Also send a direct message event to user with the refill message
                                global.io.to(String(userId)).emit('refill_message', { message: populated.message, notification: populated });

                                // --- NEW: Add to AgentLog for Chat Traceability ---
                                const AgentLog = require('../schema/AgentLog');
                                await new AgentLog({
                                    userId,
                                    agentName: 'PredictiveRefillAgent',
                                    agentResponse: populated.message,
                                    intent: 'REFILL_PROACTIVE',
                                    workflowStatus: 'PROACTIVE_ALERT'
                                }).save();
                            } catch (e) { console.error('predictive socket emit error', e); }
                        }
                    } catch (e) { console.error('predictive notif save error', e); }
                } else {
                    // Logic: If user has more than 5 days left (e.g., refilled), RESET the notified status
                    await RefillAlert.findOneAndUpdate(
                        { userId, medicineId: pred.medicineId },
                        { notified: false, daysLeft: pred.daysLeft },
                        { upsert: false }
                    );
                }
            }

            if (trace) await this.langfuse.flushAsync();
            return predictions;
        } catch (error) {
            if (trace) {
                trace.update({
                    statusMessage: error.message,
                    metadata: { error: true }
                });
                await this.langfuse.flushAsync();
            }
            console.error("PredictiveRefillAgent Error:", error);
            return [];
        }
    }
}

module.exports = new PredictiveRefillAgent();
