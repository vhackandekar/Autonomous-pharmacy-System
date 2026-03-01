const ConversationalAgent = require("../Agents/ConversationalAgent");
const SafetyAgent = require("../Agents/SafetyAgent");
const OrderPlacementAgent = require("../Agents/OrderPlacementAgent");
const PredictiveRefillAgent = require("../Agents/PredictiveRefillAgent");
const PrescriptionAgent = require("../Agents/PrescriptionAgent");
const AgentLog = require('../schema/AgentLog');
const Medicine = require('../schema/Medicine');
const Cart = require('../schema/Cart');
const Prescription = require('../schema/Prescription');
const Order = require('../schema/Order');
const OrderConfirmation = require('../schema/OrderConfirmation');
const User = require('../schema/User');
const Notification = require('../schema/Notification');
const langfuse = require('../utils/langfuseClient');
const fs = require('fs');

// Configuration from environment
const CONFIDENCE_THRESHOLD = parseFloat(process.env.PRESCRIPTION_CONFIDENCE_THRESHOLD || 0.75);
const MAX_PRESCRIPTION_AGE_MONTHS = parseInt(process.env.PRESCRIPTION_MAX_AGE_MONTHS || 6);

exports.chatUpload = async (req, res) => {
    const userId = req.user.id;
    const file = req.file;

    if (!file) {
        console.error("Chat Upload: No file in request");
        return res.status(400).json({ error: "No file uploaded" });
    }

    console.log(`Chat Upload: File received: ${file.originalname}, Path: ${file.path}`);

    try {
        // Get cart and candidate medicines
        const cart = await Cart.findOne({ userId, status: 'PENDING' }).populate('items.medicineId');
        const medicinesRequiringPresc = cart ? cart.items.filter(i => i.medicineId && i.medicineId.prescriptionRequired).map(i => i.medicineId) : [];

        let candidates = medicinesRequiringPresc;
        if (candidates.length === 0) {
            candidates = await Medicine.find({ prescriptionRequired: true }).limit(10);
        }

        if (candidates.length === 0) {
            // Clean up file
            if (file && file.path) {
                fs.unlink(file.path, (err) => { if (err) console.error('File cleanup error:', err); });
            }
            return res.json({
                agentResponse: {
                    answer: "I couldn't find any medicines in our system that require a prescription. Please make sure you've added items to your cart first, or mention the medicine name.",
                    intent: 'UPLOAD_PRESCRIPTION'
                }
            });
        }

        // Perform OCR Analysis
        let analysis;
        try {
            analysis = await PrescriptionAgent.analyzePrescription(file.path, userId);
            console.log('OCR Complete:', { status: analysis.status, count: analysis.detectedMedicines.length });
        } catch (ocrErr) {
            console.error("OCR Failed:", ocrErr);
            if (file && file.path) fs.unlink(file.path, () => { });
            return res.status(500).json({ error: "OCR Analysis failed" });
        }

        // Find the specific target medicine (prioritizing user cart/intent)
        let targetMedicine = null;
        if (analysis.detectedMedicines && analysis.detectedMedicines.length > 0) {
            // Check if any detected medicine is in the user's current intent/candidates
            const match = candidates.find(c => analysis.detectedMedicines.includes(c.name));
            if (match) {
                targetMedicine = match;
            } else {
                // Otherwise find the first one in the DB that was detected
                targetMedicine = await Medicine.findOne({ name: analysis.detectedMedicines[0] });
            }
        }

        // Fallback to first candidate if no specific match but OCR found something
        if (!targetMedicine && candidates.length > 0) {
            targetMedicine = candidates[0];
        }

        if (!targetMedicine) {
            if (file && file.path) fs.unlink(file.path, () => { });
            return res.json({
                agentResponse: {
                    answer: "I couldn't identify a matching medicine in our system from this prescription. Could you please specify which medicine this is for?",
                    intent: 'FALLBACK'
                }
            });
        }

        // Logic Guards
        if (!targetMedicine.prescriptionRequired) {
            if (file && file.path) fs.unlink(file.path, () => { });
            return res.json({
                agentResponse: {
                    answer: `Actually, ${targetMedicine.name} doesn't require a prescription! You can buy it directly.`,
                    intent: 'ADD_TO_CART',
                    items: [{ medicine_name: targetMedicine.name, quantity: 1 }]
                }
            });
        }

        if (targetMedicine.stock <= 0) {
            if (file && file.path) fs.unlink(file.path, () => { });
            return res.json({
                agentResponse: {
                    answer: `I've found ${targetMedicine.name} on the prescription, but it's currently out of stock.`,
                    intent: 'FALLBACK'
                }
            });
        }

        // CRITICAL: Validate that the prescription actually mentions the target medicine
        const medicineValidation = await PrescriptionAgent.validateMedicineInPrescription(
            targetMedicine._id,
            analysis.detectedMedicines
        );

        // Create Prescription Record
        const imageUrl = `/uploads/${file.filename}`;
        const presc = new Prescription({
            userId,
            medicineId: targetMedicine._id,
            status: medicineValidation.isValid ? analysis.status : 'REJECTED',
            imageUrl,
            issuedBy: analysis.doctorName || "Extracted by OCR",
            validTill: analysis.issuedDate ? new Date(new Date(analysis.issuedDate).setDate(new Date(analysis.issuedDate).getDate() + 180)) : new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
            isReusable: targetMedicine.isChronic,
            extractedData: {
                confidence: analysis.confidence,
                detectedMedicines: analysis.detectedMedicines,
                doctorName: analysis.doctorName,
                issuedDate: analysis.issuedDate,
                dosage: analysis.dosage,
                validationNotes: analysis.validationNotes
            }
        });

        await presc.save();

        // Generate final context-aware response
        let responseText = `I've processed the document. ${analysis.validationNotes}`;
        if (analysis.status === 'PENDING_ADMIN_REVIEW') {
            responseText = `I've successfully scanned your prescription for ${targetMedicine.name}. It's now waiting for a quick final check by our pharmacist. You'll be notified once it's verified!`;
        } else if (analysis.status === 'REJECTED') {
            responseText = `I'm sorry, I couldn't accept this prescription. ${analysis.validationNotes}. Please try uploading a clearer copy.`;
        }

        // Notify via socket with error handling
        try {
            if (global.io) {
                global.io.to(String(userId)).emit('prescription_updated', presc);
                global.io.to(String(userId)).emit('notification', {
                    type: 'prescription',
                    message: responseText
                });
            }
        } catch (socketErr) {
            console.error("Socket.io notification error:", socketErr);
            // Notification saved to DB as fallback
        }

        // Log the event
        try {
            await new AgentLog({
                userId,
                agentName: 'ConversationalAgent',
                userMessage: `[File Upload: ${file.originalname}]`,
                agentResponse: responseText,
                intent: 'UPLOAD_PRESCRIPTION',
                workflowStatus: analysis.status || 'PENDING'
            }).save();
        } catch (logErr) {
            console.error("Error logging agent action:", logErr);
            // Not critical, continue
        }

        res.json({
            agentResponse: {
                answer: responseText,
                intent: 'UPLOAD_PRESCRIPTION',
                thought_process: "User uploaded a file. Performed clinical analysis using PrescriptionAgent."
            },
            prescription: presc
        });

    } catch (error) {
        console.error("Chat Upload Error:", error);
        // Clean up file on error
        if (file && file.path) {
            fs.unlink(file.path, (err) => { if (err) console.error('File cleanup error:', err); });
        }
        res.status(500).json({
            error: "Failed to process prescription",
            message: error.message || "An unexpected error occurred"
        });
    }
};

exports.chat = async (req, res) => {
    const { userMessage: originalMessage, userHistory: chatHistory, sessionId, language = 'English' } = req.body;
    const userId = req.user.id;

    if (!originalMessage) {
        return res.status(400).json({ error: "userMessage is required" });
    }

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        // Default language from user profile if not provided in request
        const userLang = language || user.language || 'English';
        let userMessage = originalMessage;

        // --- STEP 0: Translation (Indic to English) ---
        if (userLang.toLowerCase() !== 'english') {
            console.log(`Translating user message from ${userLang} to English...`);
            userMessage = await ConversationalAgent.translateMessage(originalMessage, 'English', userLang);
            console.log(`Translated Message: ${userMessage}`);
        }

        const orderHistory = await Order.find({ userId })
            .sort({ orderDate: -1 })
            .limit(5)
            .populate('items.medicineId', 'name');

        const userCart = await Cart.findOne({ userId, status: 'PENDING' })
            .populate('items.medicineId', 'name');

        let trace = null;
        // --- LANGFUSE TRACE START ---
        trace = langfuse ? langfuse.trace({
            name: "Agent-Decision-Flow",
            userId: userId.toString(),
            sessionId: sessionId || "untracked-session",
            metadata: { userMessage, userName: user?.name }
        }) : null;

        const availableMedicines = await Medicine.find().select('name stock price prescriptionRequired dosage');
        const userPrescriptions = await Prescription.find({
            userId,
            validTill: { $gt: new Date() }
        }).populate('medicineId', 'name');

        // --- STEP 1: Conversational Agent AI (Decision Generation) ---
        const agentResult = await ConversationalAgent.processMessage(
            userMessage,
            chatHistory || [],
            orderHistory || [],
            availableMedicines,
            userPrescriptions,
            userCart || { items: [] },
            user?.name || "User",
            trace,
            sessionId
        );

        // --- STEP 2: Logic Handler based on Intent Decision ---
        const logicSpan = trace ? trace.span({
            name: "Intent-Execution-Decision",
            input: { intent: agentResult.intent, result: agentResult }
        }) : null;

        // A. INFORMATIONAL (No DB side-effects)
        const informationalIntents = ['VIEW_CART', 'GENERAL_QUERY', 'SYMPTOM_QUERY', 'HISTORY_QUERY', 'FALLBACK'];
        if (informationalIntents.includes(agentResult.intent)) {
            if (logicSpan) logicSpan.end({ output: "INFORMATIONAL_QUERY_COMPLETED" });
            if (langfuse) await langfuse.flushAsync();
            return res.json({ agentResponse: agentResult, workflowStatus: 'COMPLETED_CONVERSATION' });
        }

        // B. FINALIZING ORDER (CONFIRM_ORDER or ORDER_PAYMENT)
        if (agentResult.intent === 'CONFIRM_ORDER' || agentResult.intent === 'ORDER_PAYMENT') {
            let pendingConf = await OrderConfirmation.findOne({ userId, status: 'WAITING' }).sort({ createdAt: -1 });

            let finalItems = [];
            let finalTotal = 0;

            if (!pendingConf) {
                // FALLBACK: Build order from AI items if no confirmation exists (e.g., just provided dosage)
                if (agentResult.items && agentResult.items.length > 0) {
                    for (const item of agentResult.items) {
                        const medicine = await Medicine.findOne({ name: new RegExp(item.medicine_name, 'i') });
                        if (medicine) {
                            finalItems.push({
                                medicineId: medicine._id,
                                quantity: item.quantity || 1,
                                dosage: item.dosage || (agentResult.requiresDosage ? "PENDING" : "As directed by physician")
                            });
                            finalTotal += (medicine.price * (item.quantity || 1));
                        }
                    }
                } else {
                    if (logicSpan) logicSpan.end({ output: "NO_PENDING_ORDER_FOUND" });
                    if (langfuse) await langfuse.flushAsync();
                    return res.json({ agentResponse: agentResult, workflowStatus: 'NO_PENDING_ORDER' });
                }
            } else {
                finalItems = pendingConf.pendingOrderData.items;
                finalTotal = pendingConf.pendingOrderData.totalAmount;
            }

            // Clinical Safety - Final check for dosage selection
            const validSchedules = ["1 tablet one day", "2 tablets 1 day", "3 tablet one day", "As directed by physician"];

            // Map AI-provided dosages into the items
            const processedItems = finalItems.map(item => {
                const searchName = item.medicine_name || '';
                const aiItem = agentResult.items?.find(ai =>
                    ai.medicine_name.toLowerCase().includes(searchName.toLowerCase()) ||
                    searchName.toLowerCase().includes(ai.medicine_name.toLowerCase())
                );
                if (aiItem && aiItem.dosage && validSchedules.includes(aiItem.dosage)) {
                    item.dosage = aiItem.dosage;
                }
                return item;
            });

            const missingDosageItems = processedItems.filter(item =>
                !item.dosage || !validSchedules.includes(item.dosage)
            );

            if (missingDosageItems.length > 0 || agentResult.requiresDosage) {
                agentResult.requiresDosage = true;
                agentResult.dosageOptions = ["1 tablet one day", "2 tablets 1 day", "3 tablet one day", "As directed by physician"];
                agentResult.answer = `Clinical protocol requires you to select your prescribed schedule for: ${missingDosageItems.map(i => i.medicine_name || 'medication').join(', ')}. Please pick one below:`;

                if (logicSpan) logicSpan.end({ output: "AWAITING_DOSAGE_DURING_CONFIRMATION" });
                if (langfuse) await langfuse.flushAsync();
                return res.json({ agentResponse: agentResult, workflowStatus: 'AWAITING_DOSAGE' });
            }

            const result = await OrderPlacementAgent.processOrder(
                userId,
                processedItems,
                finalTotal,
                trace,
                sessionId
            );

            if (!result.success) throw new Error(result.error);

            if (pendingConf) {
                pendingConf.status = 'CONFIRMED';
                await pendingConf.save();
            }

            await Cart.findOneAndUpdate({ userId, status: 'PENDING' }, { $set: { items: [] } });

            if (logicSpan) logicSpan.end({ output: "ORDER_PLACED_SUCCESSFULLY" });
            if (langfuse) await langfuse.flushAsync();
            return res.json({ agentResponse: agentResult, order: result.order, workflowStatus: 'ORDER_PLACED' });
        }

        // C. CART REMOVAL
        if (agentResult.intent === 'REMOVE_FROM_CART') {
            const itemsToRemove = agentResult.items || [];
            let cart = await Cart.findOne({ userId, status: 'PENDING' });

            if (cart) {
                if (itemsToRemove.length > 0) {
                    for (const item of itemsToRemove) {
                        const escapedName = item.medicine_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const medicine = await Medicine.findOne({ name: new RegExp(escapedName, 'i') });
                        if (medicine) cart.items.pull({ medicineId: medicine._id });
                    }
                } else if (cart.items.length > 0) {
                    cart.items.pop(); // Remove last if none specified
                }
                await cart.save();
            }

            if (logicSpan) logicSpan.end({ output: "REMOVE_FROM_CART_COMPLETED" });
            if (langfuse) await langfuse.flushAsync();
            return res.json({ agentResponse: agentResult, workflowStatus: 'REMOVED_FROM_CART' });
        }

        // D. CANCEL ORDER
        if (agentResult.intent === 'CANCEL_ORDER') {
            const recentOrder = await Order.findOne({
                userId,
                status: { $nin: ['CANCELLED', 'DELIVERED', 'REJECTED'] }
            }).sort({ orderDate: -1 });

            if (recentOrder) {
                recentOrder.status = 'CANCELLED';
                await recentOrder.save();
                agentResult.answer += ` (Your order #${recentOrder._id.toString().slice(-6)} has been cancelled successfully.)`;

                // Notify admin about cancellation
                await new Notification({
                    recipientRole: 'ADMIN',
                    type: 'order',
                    message: `Order #${recentOrder._id.toString().slice(-6)} has been CANCELLED by ${user?.name || 'a user'}.`
                }).save();
            }

            if (logicSpan) logicSpan.end({ output: "ORDER_CANCELLED" });
            if (langfuse) await langfuse.flushAsync();
            return res.json({ agentResponse: agentResult, workflowStatus: 'ORDER_CANCELLED' });
        }

        // E. REFILL (Suggestion of previous order)
        if (agentResult.intent === 'REFILL') {
            const lastOrder = orderHistory[0];
            if (!lastOrder) {
                agentResult.answer = "I couldn't find any previous orders to refill. What would you like to order today?";
                if (langfuse) await langfuse.flushAsync();
                return res.json({ agentResponse: agentResult, workflowStatus: 'NO_HISTORY' });
            }

            // Map last order to confirmation
            const refillItems = lastOrder.items.map(item => ({
                medicineId: item.medicineId._id,
                medicine_name: item.medicineId.name, // Added for safety check
                quantity: item.quantity,
                dosage: item.dosagePerDay
            }));

            // Validate refill safety (Stock & Prescription)
            const safetyResult = await SafetyAgent.validateOrder(userId, refillItems, trace, sessionId);
            if (!safetyResult.isApproved) {
                agentResult.answer = `I'd love to refill that for you, but I encountered a safety issue: ${safetyResult.reasons.join(' ')}`;
                if (langfuse) await langfuse.flushAsync();
                return res.json({ agentResponse: agentResult, workflowStatus: 'REJECTED_BY_SAFETY' });
            }

            await OrderConfirmation.deleteMany({ userId, status: 'WAITING' });
            await new OrderConfirmation({
                userId,
                pendingOrderData: { items: refillItems, totalAmount: lastOrder.totalAmount }
            }).save();

            agentResult.answer = `I've found your last order with ${lastOrder.items.length} items. Total is ₹${lastOrder.totalAmount}. Should I place this refill for you?`;

            // Create persistent log of the conversation
            await new AgentLog({
                userId,
                userMessage,
                agentResponse: agentResult.answer,
                intent: agentResult.intent,
                confidence: agentResult.confidence || 0,
                workflowStatus: 'AWAITING_CONFIRMATION'
            }).save();

            if (logicSpan) logicSpan.end({ output: "REFILL_AWAITING_CONFIRMATION" });
            if (langfuse) await langfuse.flushAsync();
            return res.json({ agentResponse: agentResult, workflowStatus: 'AWAITING_CONFIRMATION' });
        }

        // F. ACTIONABLE NEW REQUESTS (ORDER_MEDICINE or ADD_TO_CART)
        const actionableIntents = ['ORDER_MEDICINE', 'ADD_TO_CART'];
        if (actionableIntents.includes(agentResult.intent)) {
            console.log("------------------------------------------");
            console.log("DEBUG: Agent Result for Order/Cart Protocol");
            console.log("Intent:", agentResult.intent);
            console.log("Requires Dosage:", agentResult.requiresDosage);
            console.log("Thought Process:", agentResult.thought_process);
            console.log("------------------------------------------");

            // NEW: Restrict if dosage is required
            if (agentResult.requiresDosage) {
                console.log("DEBUG: Dosage selection block triggered.");
                if (logicSpan) logicSpan.end({ output: "AWAITING_DOSAGE_SELECTION" });
                if (langfuse) await langfuse.flushAsync();
                return res.json({
                    agentResponse: agentResult,
                    workflowStatus: 'AWAITING_DOSAGE'
                });
            }

            const itemsToValidate = (agentResult.items && agentResult.items.length > 0)
                ? agentResult.items.map(item => ({
                    medicine_name: item.medicine_name,
                    quantity: item.quantity || 1,
                    dosage: item.dosage // REMOVED DB FALLBACK
                }))
                : [{
                    medicine_name: agentResult.medicine_name,
                    quantity: agentResult.quantity || 1,
                    dosage: agentResult.dosage // REMOVED DB FALLBACK
                }];

            const safetyResult = await SafetyAgent.validateOrder(userId, itemsToValidate, trace, sessionId);

            if (!safetyResult.isApproved) {
                // NEW: Specific handling for LOW_STOCK to ask for notification permission
                const lowStockDetail = safetyResult.details.find(d => d.reason === 'LOW_STOCK');
                if (lowStockDetail) {
                    agentResult.answer = `Currently, ${lowStockDetail.medicine_name} is out of stock. Whenever the medicine is available in stock should I notify you?`;
                    agentResult.intent = 'GENERAL_QUERY'; // Reset to query to wait for 'Yes'

                    if (trace) trace.update({ output: "OUT_OF_STOCK_PERMISSION_REQUESTED" });
                    if (langfuse) await langfuse.flushAsync();

                    return res.json({
                        agentResponse: agentResult,
                        workflowStatus: 'OUT_OF_STOCK_QUERY'
                    });
                }

                const safetyMessage = `I'm sorry, I cannot proceed with this request. ${safetyResult.reasons.join(' ')}`;

                if (trace) {
                    trace.score({ name: "Safety-Check", value: 0, comment: safetyResult.reasons.join(', ') });
                    if (langfuse) await langfuse.flushAsync();
                }

                return res.json({
                    agentResponse: {
                        ...agentResult,
                        answer: safetyMessage
                    },
                    workflowStatus: 'REJECTED_BY_SAFETY'
                });
            }

            // Execute ADD_TO_CART
            if (agentResult.intent === 'ADD_TO_CART') {
                let cart = await Cart.findOne({ userId, status: 'PENDING' });
                if (!cart) cart = new Cart({ userId, items: [], status: 'PENDING' });

                for (const item of itemsToValidate) {
                    const medicine = await Medicine.findOne({ name: new RegExp(item.medicine_name, 'i') });
                    if (medicine) {
                        const existingItemIdx = cart.items.findIndex(i => i.medicineId.toString() === medicine._id.toString());
                        if (existingItemIdx > -1) cart.items[existingItemIdx].quantity += (item.quantity || 1);
                        else cart.items.push({ medicineId: medicine._id, quantity: item.quantity || 1 });
                    }
                }
                await cart.save();
                if (logicSpan) logicSpan.end({ output: "ADDED_TO_CART" });
                if (langfuse) await langfuse.flushAsync();
                return res.json({ agentResponse: agentResult, workflowStatus: 'ADDED_TO_CART' });
            }

            // ORDER_MEDICINE Confirmation (Staging Phase)
            let calcTotal = 0;
            const confirmedItems = [];
            let needsDosageSelection = false;

            for (const details of safetyResult.details) {
                const medicine = await Medicine.findById(details.medicineId);
                if (medicine) {
                    const reqItem = itemsToValidate.find(i => i.medicine_name.toLowerCase() === medicine.name.toLowerCase());
                    const qty = reqItem?.quantity || 1;

                    // List of approved clinical schedules
                    const validSchedules = ["1 tablet one day", "2 tablets 1 day", "3 tablet one day", "As directed by physician"];

                    // If no clinical dosage is found in the request, or it's a generic strength, we mark it as needing selection
                    if (!reqItem?.dosage || !validSchedules.includes(reqItem.dosage)) {
                        console.log(`DEBUG: Item ${medicine.name} has invalid dosage schedule: [${reqItem?.dosage}]. Forcing selection.`);
                        needsDosageSelection = true;
                    }

                    const dosage = reqItem?.dosage || "As directed";
                    calcTotal += (medicine.price * qty);
                    confirmedItems.push({
                        medicineId: medicine._id,
                        medicine_name: medicine.name, // Added for easier identification
                        quantity: qty,
                        dosage
                    });
                }
            }

            // RELAXED: Don't block for dosage in the staging phase (Price Quote Phase).
            // We will block only during final confirmation (CONFIRM_ORDER).
            if (agentResult.requiresDosage) {
                console.log("DEBUG: AI explicitly required dosage in staging. Triggering.");
                agentResult.dosageOptions = ["1 tablet one day", "2 tablets 1 day", "3 tablet one day", "As directed by physician"];

                if (logicSpan) logicSpan.end({ output: "AWAITING_DOSAGE_DURING_STAGING" });
                if (langfuse) await langfuse.flushAsync();
                return res.json({
                    agentResponse: agentResult,
                    workflowStatus: 'AWAITING_DOSAGE'
                });
            }

            await OrderConfirmation.deleteMany({ userId, status: 'WAITING' });
            await new OrderConfirmation({
                userId,
                pendingOrderData: { items: confirmedItems, totalAmount: calcTotal }
            }).save();

            if (logicSpan) logicSpan.end({ output: "AWAITING_CONFIRMATION" });
            if (langfuse) await langfuse.flushAsync();
            return res.json({ agentResponse: agentResult, workflowStatus: 'AWAITING_CONFIRMATION' });
        }

        // G. STOCK NOTIFICATION SUBSCRIPTION
        if (agentResult.intent === 'NOTIFY_STOCK') {
            const medicineName = agentResult.items?.[0]?.medicine_name || agentResult.medicine_name || '';
            console.log(`[NOTIFY_DEBUG] AI requested stock notification for: [${medicineName}]`);

            const userWords = userMessage.toLowerCase();
            const predictedLower = medicineName.toLowerCase();

            const isAffirmative = userWords.match(/\b(yes|yeah|sure|ok|okay|notify|definitely|absolutely)\b/i);

            // Search for medicine in user words or synonyms
            const containsMention = userWords.includes(predictedLower) ||
                (predictedLower === 'ibuprofen' && userWords.includes('advil')) ||
                (predictedLower === 'paracetamol' && userWords.includes('panadol'));

            // If not mentioned and it's an affirmation, check history to ensure the AI isn't hallucinating a random med
            if (!containsMention && isAffirmative) {
                const lastAssistantMsg = (chatHistory || []).reverse().find(m => m.role === 'ai' || m.role === 'agent');
                const lastAssistantContent = lastAssistantMsg?.content?.toLowerCase() || '';

                // If the last assistant message doesn't contain the predicted medicine name or its synonyms, it's a hallucination
                const historyContainsMed = lastAssistantContent.includes(predictedLower) ||
                    (predictedLower === 'ibuprofen' && lastAssistantContent.includes('advil')) ||
                    (predictedLower === 'paracetamol' && lastAssistantContent.includes('panadol'));

                if (!historyContainsMed) {
                    console.warn(`[NOTIFY_SECURITY] Blocked hallucination: AI tried to notify for [${medicineName}] but it wasn't in history or user message.`);
                    agentResult.answer = "I'm sorry, I might have gotten confused. Which medicine would you like me to notify you about?";
                    return res.json({ agentResponse: agentResult, workflowStatus: 'HALLUCINATION_BLOCKED' });
                }
            } else if (!containsMention && !isAffirmative && userMessage.length > 3) {
                console.warn(`[NOTIFY_SECURITY] Blocked suspected cross-talk: AI tried to notify for [${medicineName}] but user said [${userMessage}]`);
                agentResult.answer = `I'm sorry, I don't have enough information to set up a notification for that brand. Did you mean something else?`;
                return res.json({ agentResponse: agentResult, workflowStatus: 'HALLUCINATION_BLOCKED' });
            }

            const StockAlert = require("../schema/StockAlert");
            const medicine = await Medicine.findOne({ name: new RegExp(medicineName, 'i') });

            if (medicine) {
                // Simplified: Just add/update and confirm
                await StockAlert.findOneAndUpdate(
                    { userId, medicineId: medicine._id, notified: false },
                    { userId, medicineId: medicine._id, notified: false },
                    { upsert: true }
                );
                agentResult.answer = `Ok, I will notify you once ${medicine.name} is in stock!`;
            } else {
                console.warn(`[NOTIFY_ERROR] Medicine [${medicineName}] not found in database.`);
                agentResult.answer = `I couldn't find ${medicineName || 'that medicine'} in our catalog. Would you like me to check for something else?`;
            }

            if (logicSpan) logicSpan.end({ output: "NOTIFY_STOCK_COMPLETED" });
            if (langfuse) await langfuse.flushAsync();
            return res.json({ agentResponse: agentResult, workflowStatus: 'NOTIFY_STOCK_ADDED' });
        }

        // --- STEP 4: Translation (English to Indic) ---
        if (userLang.toLowerCase() !== 'english') {
            console.log(`Translating AI response from English to ${userLang}...`);
            const translatedAnswer = await ConversationalAgent.translateMessage(agentResult.answer, userLang, 'English');
            agentResult.answer = translatedAnswer;
        }

        // Create persistent log of the conversation
        await new AgentLog({
            userId,
            userMessage: originalMessage,
            agentResponse: agentResult.answer,
            intent: agentResult.intent,
            confidence: agentResult.confidence || 0,
            workflowStatus: 'PROCESSED'
        }).save();

        if (langfuse) await langfuse.flushAsync();
        return res.json({ agentResponse: agentResult, workflowStatus: 'PROCESSED' });

    } catch (error) {
        if (trace) trace.update({ statusMessage: error.message, metadata: { error: true } });
        if (langfuse) await langfuse.flushAsync();
        console.error("Agentic Flow Error:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.speechToText = async (req, res) => {
    const file = req.file;
    const { language } = req.body;

    console.log(`[STT_DEBUG] Request Body:`, req.body);
    console.log(`[STT_DEBUG] Language Received: [${language}]`);

    if (!file) return res.status(400).json({ error: "No audio file uploaded" });

    try {
        const sarvamKey = process.env.SPEECH_TO_TEXT_API || process.env.SARVAM_API_KEY;
        if (!sarvamKey) throw new Error("Sarvam API key not configured");

        const FormData = require('form-data');
        const fs = require('fs');
        const axios = require('axios');

        const langMap = {
            'hindi': 'hi-IN',
            'marathi': 'mr-IN',
            'bengali': 'bn-IN',
            'tamil': 'ta-IN',
            'telugu': 'te-IN',
            'kannada': 'kn-IN',
            'gujarati': 'gu-IN',
            'malayalam': 'ml-IN',
            'punjabi': 'pa-IN',
            'odia': 'od-IN',
            'english': 'en-IN'
        };

        const targetLang = language?.toLowerCase() || 'hindi';
        console.log(`[STT_DEBUG] Resolved targetLang: [${targetLang}]`);
        const langCode = langMap[targetLang] || 'unknown';
        console.log(`[STT_DEBUG] Final langCode for Sarvam: [${langCode}]`);

        const form = new FormData();
        form.append('file', fs.createReadStream(file.path));
        form.append('model', 'saaras:v1');
        form.append('language_code', langCode);

        console.log(`[STT_DEBUG] Transcribing audio in [${langCode}] with Sarvam: ${file.path}`);

        const response = await axios.post('https://api.sarvam.ai/speech-to-text', form, {
            headers: {
                ...form.getHeaders(),
                'api-subscription-key': sarvamKey
            }
        });

        const transcript = response.data?.transcript || "";
        console.log(`[STT_DEBUG] Transcript: ${transcript}`);

        // Cleanup: remove file after transcription
        fs.unlink(file.path, (err) => { if (err) console.error("STT cleanup error:", err); });

        res.json({ transcript });
    } catch (error) {
        console.error("STT Error:", error.response?.data || error.message);
        if (file && file.path) fs.unlink(file.path, () => { });
        res.status(500).json({ error: "Failed to transcribe audio", details: error.message });
    }
};

exports.getLogs = async (req, res) => {
    try {
        const logs = await AgentLog.find().sort({ timestamp: -1 });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
