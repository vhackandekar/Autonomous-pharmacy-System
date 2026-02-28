const Prescription = require('../schema/Prescription');
const Notification = require('../schema/Notification');
const Medicine = require('../schema/Medicine');
const PrescriptionAgent = require('../Agents/PrescriptionAgent');
const fs = require('fs');

/**
 * Validates if a user has a valid prescription for a specific medicine at checkout
 * NOW: Also cross-checks that the extracted prescription mentions this medicine
 */
exports.validatePrescription = async (req, res) => {
    try {
        const { userId, medicineId } = req.query;

        const prescription = await Prescription.findOne({
            userId,
            medicineId,
            status: 'VERIFIED',
            validTill: { $gt: new Date() }
        });

        if (!prescription) {
            const pending = await Prescription.findOne({
                userId,
                medicineId,
                status: { $in: ['UPLOADED', 'OCR_PARSED', 'PENDING_ADMIN_REVIEW'] }
            });

            return res.json({
                valid: false,
                status: pending ? pending.status : 'MISSING',
                message: pending ? "Verification in progress..." : "No valid prescription found."
            });
        }

        // CRITICAL: Cross-check extracted medicines with requested medicine
        const extractedMedicines = prescription.extractedData?.detectedMedicines || [];
        const medicineValidation = prescription.extractedData?.medicineValidation;

        // If validation data is missing, re-validate (for old prescriptions)
        if (!medicineValidation) {
            const medicine = await Medicine.findById(medicineId);
            const isValidMedicine = extractedMedicines.some(med => 
                med.toLowerCase() === medicine.name.toLowerCase()
            );

            if (!isValidMedicine) {
                return res.json({
                    valid: false,
                    status: 'MISMATCH',
                    message: `Prescription does not mention ${medicine.name}. Found: ${extractedMedicines.join(', ')}`
                });
            }
        } else if (!medicineValidation.isValid) {
            return res.json({
                valid: false,
                status: 'MISMATCH',
                message: `Prescription validation failed: ${medicineValidation.reason}`,
                details: medicineValidation
            });
        }

        res.json({ valid: true, status: 'VERIFIED', prescription });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Fetch all prescriptions for the logged-in user
 */
exports.getUserPrescriptions = async (req, res) => {
    try {
        const list = await Prescription.find({ userId: req.user.id })
            .populate('medicineId', 'name dosage')
            .sort({ createdAt: -1 });
        res.json(list);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Handle Prescription Upload & Initiate Autonomous OCR Task
 */
exports.uploadPrescription = async (req, res) => {
    try {
        const { userId, medicineId } = req.body;
        if (!userId || !medicineId || !req.file) {
            return res.status(400).json({ error: 'Missing required fields or file' });
        }

        const medicine = await Medicine.findById(medicineId);
        if (!medicine) {
            if (req.file.path) fs.unlink(req.file.path, () => { });
            return res.status(404).json({ error: 'Medicine not found' });
        }

        const prescription = new Prescription({
            userId,
            medicineId,
            imageUrl: `/uploads/${req.file.filename}`,
            status: 'UPLOADED'
        });

        await prescription.save();

        // RUN BACKGROUND OCR TASK (Non-Blocking)
        processOCRTask(prescription._id, req.file.path).catch(e => console.error("BG OCR Fail:", e));

        res.status(201).json({ success: true, message: "Upload successful. Verification started.", prescription });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Autonomous Background OCR Processing Task
 */
async function processOCRTask(id, filePath) {
    const presc = await Prescription.findById(id).populate('medicineId');
    if (!presc) return;

    try {
        const result = await PrescriptionAgent.analyzePrescription(filePath);

        // CRITICAL: Validate that requested medicine is in the prescription
        const medicineValidation = await PrescriptionAgent.validateMedicineInPrescription(
            presc.medicineId._id,
            result.detectedMedicines
        );

        presc.extractedData = {
            confidence: result.confidence,
            detectedMedicines: result.detectedMedicines,
            doctorName: result.doctorName,
            issuedDate: result.issuedDate,
            dosage: result.dosage,
            validationNotes: result.validationNotes,
            medicineValidation: medicineValidation // Store validation result
        };

        // REJECT if medicine mismatch
        if (!medicineValidation.isValid) {
            presc.status = 'REJECTED';
            presc.extractedData.validationNotes = `REJECTED: ${medicineValidation.reason}. ` +
                `Requested: ${presc.medicineId.name}. ` +
                `Found in prescription: ${medicineValidation.detectedMedicines ? medicineValidation.detectedMedicines.join(', ') : 'None'}`;
            await presc.save();

            if (global.io) {
                global.io.to(String(presc.userId)).emit('prescription_updated', presc);
                global.io.to('admin').emit('notification', {
                    type: 'prescription_rejected',
                    message: `❌ Prescription for ${presc.medicineId.name} REJECTED: Medicine not found in document.`
                });
            }
            return;
        }

        // If validation passed, set status based on OCR result
        presc.status = result.status;
        presc.issuedBy = result.doctorName || 'Extracted via OCR';

        // Expiry Logic: Use detected date or default to 180 days
        const baseDate = result.issuedDate ? new Date(result.issuedDate) : new Date();
        const expiry = new Date(baseDate);
        expiry.setDate(expiry.getDate() + 180);
        presc.validTill = expiry;

        presc.isReusable = presc.medicineId.isChronic;

        await presc.save();

        // Broadcast update via Socket.IO
        if (global.io) {
            global.io.to(String(presc.userId)).emit('prescription_updated', presc);
            global.io.to('admin').emit('notification', {
                type: 'prescription_alert',
                message: `✅ Prescription for ${presc.medicineId.name} processed. Status: ${presc.status}. Match: ${medicineValidation.reason}`
            });
        }
    } catch (err) {
        console.error("OCR Process Fatal Error:", err);
        presc.status = 'REJECTED';
        presc.extractedData = { validationNotes: `Extraction Failed: ${err.message}` };
        await presc.save();

        if (global.io) {
            global.io.to(String(presc.userId)).emit('prescription_updated', presc);
        }
    }
}

/**
 * Admin Panel: Review and Approve/Reject Prescription
 */
exports.adminReviewPrescription = async (req, res) => {
    try {
        const { status, rejectionReason } = req.body;
        const presc = await Prescription.findById(req.params.id).populate('medicineId');
        if (!presc) return res.status(404).json({ error: "Record not found" });

        presc.status = status;
        presc.rejectionReason = rejectionReason;
        presc.adminVerifiedBy = req.user.id;
        presc.adminVerifiedAt = Date.now();

        await presc.save();

        const notif = await new Notification({
            userId: presc.userId,
            type: 'prescription',
            message: status === 'VERIFIED'
                ? `✅ Prescription for ${presc.medicineId.name} has been verified.`
                : `❌ Prescription for ${presc.medicineId.name} was rejected.`
        }).save();

        if (global.io) {
            global.io.to(String(presc.userId)).emit('notification', notif);
            global.io.to(String(presc.userId)).emit('prescription_updated', presc);
        }

        res.json({ success: true, presc });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Delete Prescription (User Action)
 */
exports.deletePrescription = async (req, res) => {
    try {
        const presc = await Prescription.findOne({ _id: req.params.id, userId: req.user.id });
        if (!presc) return res.status(404).json({ error: 'Not found' });

        const fsPath = presc.imageUrl.startsWith('/') ? presc.imageUrl.substring(1) : presc.imageUrl;
        if (fs.existsSync(fsPath)) fs.unlinkSync(fsPath);

        await Prescription.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getAllPrescriptions = async (req, res) => {
    try {
        const list = await Prescription.find().populate('userId', 'name email').populate('medicineId', 'name').sort({ createdAt: -1 });
        res.json(list);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
