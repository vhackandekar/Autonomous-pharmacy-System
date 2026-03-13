const Prescription = require('../schema/Prescription');
const Notification = require('../schema/Notification');
const Medicine = require('../schema/Medicine');
const PrescriptionAgent = require('../Agents/PrescriptionAgent');
const fs = require('fs');
const { uploadToCloudinary } = require('../utils/cloudinary');
const ErrorHandler = require('../utils/ErrorHandler');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Validates if a user has a valid prescription for a specific medicine at checkout
 */
exports.validatePrescription = asyncHandler(async (req, res, next) => {
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
            success: true,
            data: {
                valid: false,
                status: pending ? pending.status : 'MISSING',
                message: pending ? "Verification in progress..." : "No valid prescription found."
            }
        });
    }

    // CRITICAL: Cross-check extracted medicines with requested medicine
    const extractedMedicines = prescription.extractedData?.detectedMedicines || [];
    const medicineValidation = prescription.extractedData?.medicineValidation;

    if (!medicineValidation) {
        const medicine = await Medicine.findById(medicineId);
        const isValidMedicine = extractedMedicines.some(med =>
            med.toLowerCase() === medicine.name.toLowerCase()
        );

        if (!isValidMedicine) {
            return res.json({
                success: true,
                data: {
                    valid: false,
                    status: 'MISMATCH',
                    message: `Prescription does not mention ${medicine.name}. Found: ${extractedMedicines.join(', ')}`
                }
            });
        }
    } else if (!medicineValidation.isValid) {
        return res.json({
            success: true,
            data: {
                valid: false,
                status: 'MISMATCH',
                message: `Prescription validation failed: ${medicineValidation.reason}`,
                details: medicineValidation
            }
        });
    }

    res.json({
        success: true,
        data: {
            valid: true,
            status: 'VERIFIED',
            prescription
        }
    });
});

/**
 * Fetch all prescriptions for the logged-in user
 */
exports.getUserPrescriptions = asyncHandler(async (req, res, next) => {
    const list = await Prescription.find({ userId: req.user.id })
        .populate('medicineId', 'name dosage')
        .sort({ createdAt: -1 });

    res.json({
        success: true,
        data: { prescriptions: list }
    });
});

/**
 * Handle Prescription Upload & Initiate Autonomous OCR Task
 */
exports.uploadPrescription = asyncHandler(async (req, res, next) => {
    const { userId, medicineId, issuedBy, validTill } = req.body;
    if (!userId || !medicineId || !req.file || !issuedBy || !validTill) {
        if (req.file?.path) fs.unlink(req.file.path, () => { });
        return next(new ErrorHandler('Missing required fields or file', 400));
    }

    // Issued By: min 3 chars
    if (issuedBy.trim().length < 3) {
        if (req.file.path) fs.unlink(req.file.path, () => { });
        return next(new ErrorHandler("Issued By (Doctor/Hospital) must be at least 3 characters long.", 400));
    }

    // Date check: must be in the future
    const pickedDate = new Date(validTill);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (pickedDate <= today) {
        if (req.file.path) fs.unlink(req.file.path, () => { });
        return next(new ErrorHandler("Prescription validity must be a future date.", 400));
    }

    // File type check
    const allowedMime = ['image/jpeg', 'image/png', 'application/pdf', 'image/webp'];
    if (!allowedMime.includes(req.file.mimetype)) {
        if (req.file.path) fs.unlink(req.file.path, () => { });
        return next(new ErrorHandler("Invalid file type. Please upload a JPG, PNG, WEBP image or a PDF document.", 400));
    }

    const medicine = await Medicine.findById(medicineId);
    if (!medicine) {
        if (req.file.path) fs.unlink(req.file.path, () => { });
        return next(new ErrorHandler('Medicine not found', 404));
    }

    const prescription = new Prescription({
        userId,
        medicineId,
        issuedBy: issuedBy.trim(),
        validTill: pickedDate,
        imageUrl: `/uploads/${req.file.filename}`,
        status: 'UPLOADED'
    });

    await prescription.save();

    // RUN BACKGROUND OCR TASK
    processOCRTask(prescription._id, req.file.path).catch(e => console.error("BG Task Fail:", e));

    // Notify Admin
    const adminNotif = await Notification.create({
        userId: userId,
        recipientRole: 'ADMIN',
        type: 'prescription',
        message: `New prescription uploaded: ${medicine.name}`
    });
    if (global.io) global.io.to('admin').emit('notification', adminNotif);

    res.status(201).json({
        success: true,
        data: {
            message: "Upload successful. Verification started.",
            prescription
        }
    });
});

/**
 * Admin Panel: Review and Approve/Reject Prescription
 */
exports.adminReviewPrescription = asyncHandler(async (req, res, next) => {
    const { status, rejectionReason } = req.body;

    // 1. Validation
    if (!['VERIFIED', 'REJECTED'].includes(status)) {
        return next(new ErrorHandler("Invalid status selection.", 400));
    }
    if (status === 'REJECTED' && (!rejectionReason || rejectionReason.trim().length < 5)) {
        return next(new ErrorHandler("Please provide a clear reason for rejection (min 5 chars).", 400));
    }

    const presc = await Prescription.findById(req.params.id).populate('medicineId');
    if (!presc) return next(new ErrorHandler("Record not found", 404));

    presc.status = status;
    presc.rejectionReason = rejectionReason ? rejectionReason.trim() : "";
    presc.adminVerifiedBy = req.user.id;
    presc.adminVerifiedAt = Date.now();

    await presc.save();

    const notif = await new Notification({
        userId: presc.userId,
        type: 'prescription',
        message: status === 'VERIFIED'
            ? `✅ Your prescription for ${presc.medicineId.name} has been verified! You can now proceed with your order.`
            : `❌ Your prescription for ${presc.medicineId.name} was rejected. Reason: ${rejectionReason}`
    }).save();

    if (global.io) {
        global.io.to(String(presc.userId)).emit('notification', notif);
        global.io.to(String(presc.userId)).emit('prescription_updated', presc);
    }

    res.json({
        success: true,
        data: {
            message: `Prescription ${status.toLowerCase()} successfully`,
            prescription: presc
        }
    });
});

/**
 * Delete Prescription (User Action)
 */
exports.deletePrescription = asyncHandler(async (req, res, next) => {
    const presc = await Prescription.findById(req.params.id);
    if (!presc) return next(new ErrorHandler('Not found', 404));

    // Security: Owner or Admin
    if (presc.userId.toString() !== req.user.id && req.user.role !== 'ADMIN') {
        return next(new ErrorHandler("Access denied.", 403));
    }

    const fsPath = presc.imageUrl.startsWith('/') ? presc.imageUrl.substring(1) : presc.imageUrl;
    if (fs.existsSync(fsPath)) fs.unlinkSync(fsPath);

    await Prescription.findByIdAndDelete(req.params.id);
    res.json({
        success: true,
        data: { message: 'Prescription deleted successfully' }
    });
});

exports.getAllPrescriptions = asyncHandler(async (req, res, next) => {
    const list = await Prescription.find()
        .populate('userId', 'name email')
        .populate('medicineId', 'name')
        .sort({ createdAt: -1 });

    res.json({
        success: true,
        data: { prescriptions: list }
    });
});

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

                const adminMsg = `❌ Prescription for ${presc.medicineId.name} REJECTED: Medicine not found in document.`;
                const adminNotif = await Notification.create({
                    userId: presc.userId,
                    recipientRole: 'ADMIN',
                    type: 'prescription',
                    message: adminMsg
                });
                global.io.to('admin').emit('notification', adminNotif);
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

            const adminMsg = `✅ Prescription for ${presc.medicineId.name} Cloudinary-synced and processed.`;
            const adminNotif = await Notification.create({
                userId: presc.userId,
                recipientRole: 'ADMIN',
                type: 'prescription',
                message: adminMsg
            });
            global.io.to('admin').emit('notification', adminNotif);
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
