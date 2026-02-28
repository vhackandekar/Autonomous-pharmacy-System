const Medicine = require('../schema/Medicine');
const Prescription = require('../schema/Prescription');

class SafetyAgent {
    async validateOrder(userId, items, parentTrace = null, sessionId = null) {
        const langfuse = require('../utils/langfuseClient');
        const span = parentTrace ? parentTrace.span({
            name: "Safety-Validation-Agent",
            input: { items, userId },
            metadata: { sessionId }
        }) : null;

        const results = [];
        let isApproved = true;
        const reasons = [];

        for (const item of items) {
            const escapedName = item.medicine_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Use word boundaries to avoid partial matches (e.g., "Cold" matching "Cold & Cough")
            const medicine = await Medicine.findOne({ name: { $regex: new RegExp(`\\b${escapedName}\\b`, 'i') } });

            if (!medicine) {
                isApproved = false;
                reasons.push(`Medicine ${item.medicine_name} not found in database.`);
                results.push({ medicine_name: item.medicine_name, status: 'REJECTED', reason: 'NOT_FOUND' });
                continue;
            }

            // 1. Check Stock
            if (medicine.stock < (item.quantity || 1)) {
                isApproved = false;
                reasons.push(`Insufficient stock for ${medicine.name}. Available: ${medicine.stock}`);
                results.push({ medicine_name: medicine.name, status: 'REJECTED', reason: 'LOW_STOCK' });
                continue;
            }

            // 2. Check Prescription
            if (medicine.prescriptionRequired) {
                const validPrescription = await Prescription.findOne({
                    userId,
                    medicineId: medicine._id,
                    status: 'VERIFIED',
                    validTill: { $gt: new Date() },
                    $or: [
                        { isReusable: true },
                        { isUsed: false }
                    ]
                });

                if (!validPrescription) {
                    isApproved = false;
                    reasons.push(`A valid, un-used prescription is required for ${medicine.name}.`);
                    results.push({ medicine_name: medicine.name, status: 'REJECTED', reason: 'PRESCRIPTION_MISSING_OR_USED' });
                    continue;
                }
            }

            results.push({ medicine_name: medicine.name, status: 'APPROVED', medicineId: medicine._id });
        }

        const finalResult = {
            isApproved,
            reasons,
            details: results
        };

        if (span) {
            span.end({
                output: finalResult
            });
        }

        return finalResult;
    }
}

module.exports = new SafetyAgent();
