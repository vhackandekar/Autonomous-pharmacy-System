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

        // --- NEW: Address Validation ---
        const User = require('../schema/User');
        const user = await User.findById(userId);
        if (!user || !user.address1 || !user.city) {
            isApproved = false;
            reasons.push("Delivery address is missing from your profile.");
            return {
                isApproved: false,
                reasons,
                details: items.map(i => ({ medicine_name: i.medicine_name, status: 'REJECTED', reason: 'ADDRESS_MISSING' }))
            };
        }

        for (const item of items) {
            // Robust normalization of medicine name
            const rawName = item?.medicine_name || item?.name || "";
            const medName = String(rawName).trim();

            if (!medName || medName.toLowerCase() === 'undefined' || medName === "") {
                console.warn("[SafetyAgent] Skipping item with invalid name:", item);
                continue;
            }

            const escapedName = medName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // 1. Try Fuzzy Match (Contains Name or Alternate Names)
            let medicine = await Medicine.findOne({
                $or: [
                    { name: { $regex: new RegExp(escapedName, 'i') } },
                    { alternateNames: { $elemMatch: { $regex: new RegExp(`^${escapedName}$`, 'i') } } }
                ]
            });

            if (!medicine) {
                isApproved = false;
                reasons.push(`Medicine "${medName}" not found in our clinical database.`);
                results.push({ medicine_name: medName, status: 'REJECTED', reason: 'NOT_FOUND' });
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
                    status: { $in: ['VERIFIED', 'PENDING_ADMIN_REVIEW'] },
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
