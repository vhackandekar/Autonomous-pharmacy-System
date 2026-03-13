const Prescription = require('../schema/Prescription');
const Notification = require('../schema/Notification');
const Medicine = require('../schema/Medicine');
const PrescriptionAgent = require('../Agents/PrescriptionAgent');
const fs = require('fs');
const { uploadToCloudinary } = require('../utils/cloudinary');

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
                status: { $in: ['UPLOADED', 'OCR_PARSED', 'PENDING_ADMIN_REVIEW', 'WARNING', 'DANGEROUS'] }
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
        const { userId, medicineId, issuedBy, validTill } = req.body;
        if (!userId || !medicineId || !req.file || !issuedBy || !validTill) {
            if (req.file?.path) fs.unlink(req.file.path, () => { });
            return res.status(400).json({ error: 'Missing required fields or file' });
        }

        // Issued By: min 3 chars
        if (issuedBy.trim().length < 3) {
            if (req.file.path) fs.unlink(req.file.path, () => { });
            return res.status(400).json({ error: "Issued By (Doctor/Hospital) must be at least 3 characters long." });
        }

        // Date check: must be in the future
        const pickedDate = new Date(validTill);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (pickedDate <= today) {
            if (req.file.path) fs.unlink(req.file.path, () => { });
            return res.status(400).json({ error: "Prescription validity must be a future date." });
        }

        // File type check (server-side)
        const allowedMime = ['image/jpeg', 'image/png', 'application/pdf', 'image/webp'];
        if (!allowedMime.includes(req.file.mimetype)) {
            if (req.file.path) fs.unlink(req.file.path, () => { });
            return res.status(400).json({ error: "Invalid file type. Please upload a JPG, PNG, WEBP image or a PDF document." });
        }

        const medicine = await Medicine.findById(medicineId);
        if (!medicine) {
            if (req.file.path) fs.unlink(req.file.path, () => { });
            return res.status(404).json({ error: 'Medicine not found' });
        }

        const prescription = new Prescription({
            userId,
            medicineId,
            issuedBy: issuedBy.trim(),
            validTill: pickedDate,
            imageUrl: `/uploads/${req.file.filename}`, // Fallback temporary URL
            status: 'UPLOADED'
        });

        await prescription.save();

        // RUN BACKGROUND OCR AND CLOUDINARY UPLOAD TASK (Non-Blocking)
        processOCRTask(prescription._id, req.file.path).catch(e => console.error("BG Task Fail:", e));

        // Notify Admin for awareness
        try {
            if (global.io) global.io.to('admin').emit('new_prescription_upload', prescription);
        } catch (e) { console.error('admin notify error', e); }

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
        // 1. PERFORM OCR ANALYSIS (Using local file)
        const result = await PrescriptionAgent.analyzePrescription(filePath, presc.userId);

        // 2. UPLOAD TO CLOUDINARY AND DELETE LOCAL FILE
        const cloudResult = await uploadToCloudinary(filePath);
        if (cloudResult) {
            presc.imageUrl = cloudResult.url;
            presc.cloudinaryPublicId = cloudResult.publicId;
        }

        // 3. CLINICAL VALIDATION ENGINE
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
            medicineValidation: medicineValidation,
            structuredData: result.structuredData
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

        // VALIDATION PASSED
        presc.status = result.status;
        presc.issuedBy = result.doctorName || 'Extracted via OCR';

        const baseDate = result.issuedDate ? new Date(result.issuedDate) : new Date();
        const expiry = new Date(baseDate);
        expiry.setDate(expiry.getDate() + 180);
        presc.validTill = expiry;

        presc.isReusable = presc.medicineId.isChronic;

        await presc.save();

        if (global.io) {
            global.io.to(String(presc.userId)).emit('prescription_updated', presc);
            global.io.to('admin').emit('notification', {
                type: 'prescription_alert',
                message: `✅ Prescription for ${presc.medicineId.name} Cloudinary-synced and processed.`
            });
        }
    } catch (err) {
        console.error("OCR Process Fatal Error:", err);
        // Ensure local file is cleaned up if Cloudinary upload didn't happen
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

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
        const presc = await Prescription.findById(req.params.id);
        if (!presc) return res.status(404).json({ error: 'Not found' });

        // Security: Owner or Admin
        if (presc.userId.toString() !== req.user.id && req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: "Access denied." });
        }

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
