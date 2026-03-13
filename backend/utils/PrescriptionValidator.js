const Medicine = require('../schema/Medicine');

/**
 * AI-Based Prescription Validation Engine
 * 
 * Implements a three-level safety hierarchy:
 * 1. ACCEPTED (High confidence, all checks pass)
 * 2. PHARMACIST_REVIEW_REQUIRED (Partial confidence or minor clinical ambiguity)
 * 3. REJECTED (Unsafe, blurred, or fraudulent)
 */
class PrescriptionValidator {
    constructor() {
        this.DOSAGE_REGEX = /(\d+)\s?(mg|g|ml|tabs|caps|units)/gi;
        this.FREQUENCY_REGEX = /(once|twice|thrice|daily|od|bid|tds|qid|hs|q4h|weekly)/gi;
        this.DURATION_REGEX = /(\d+)\s?(days|weeks|months)/gi;
    }

    async validate(extractedData, confidence) {
        const report = {
            medicines: [],
            warnings: [],
            doctor: {
                name: extractedData.doctorName || 'Not identified',
                isAuthentic: false,
                metrics: []
            },
            status: 'PHARMACIST_REVIEW_REQUIRED',
            reason: '',
            confidenceScore: confidence || 0
        };

        // --- HARD REJECTION CHECKS ---
        if (report.confidenceScore < 60) {
            report.status = 'REJECTED';
            report.reason = 'OCR confidence below 60%. Image may be too blurred or damaged.';
            return report;
        }

        if (!extractedData.detectedMedicines || extractedData.detectedMedicines.length === 0) {
            report.status = 'REJECTED';
            report.reason = 'Prescription REJECTED: No medicine names identified in the document.';
            return report;
        }

        // --- AUTHENTICITY CHECK (Doctor Info) ---
        this.verifyAuthenticity(extractedData, report);
        if (report.status === 'REJECTED') {
            report.reason = 'Prescription REJECTED: Doctor name or clinic credentials (License/Header) are missing.';
            return report;
        }

        // --- CLINICAL VALIDATION ---
        for (const medName of extractedData.detectedMedicines) {
            const result = await this.verifyDrug(medName, extractedData.rawText);
            report.medicines.push(result);

            if (result.validationStatus === 'REJECTED') {
                report.status = 'REJECTED';
                report.reason = `Prescription REJECTED (Safety Error): ${result.message}`;
                return report;
            }
        }

        // --- FINAL STATUS: All others go to Admin Verification ---
        report.status = 'PHARMACIST_REVIEW_REQUIRED';
        if (!report.reason) report.reason = 'Sent to Pharmacist for final human verification.';

        return report;

        return report;
    }

    async verifyDrug(name, rawText) {
        const medicine = await Medicine.findOne({
            $or: [
                { name: new RegExp(`^${name}$`, 'i') },
                { alternateNames: { $in: [new RegExp(`^${name}$`, 'i')] } }
            ]
        });

        const entry = {
            name: name,
            dosage: this.extractContextField(rawText, name, this.DOSAGE_REGEX),
            frequency: this.extractContextField(rawText, name, this.FREQUENCY_REGEX),
            duration: this.extractContextField(rawText, name, this.DURATION_REGEX),
            validationStatus: 'VALID',
            message: ''
        };

        if (!medicine) {
            entry.validationStatus = 'AMBIGUOUS';
            entry.message = 'Medicine spelling uncertain or not in database.';
            return entry;
        }

        entry.name = medicine.name;

        // A. Dosage Safety (e.g. Paracetamol 1000mg x 5 check)
        if (entry.dosage && entry.frequency) {
            const dailyDose = this.calculateDailyDose(entry.dosage, entry.frequency);
            if (medicine.name.toLowerCase() === 'paracetamol' && dailyDose > 4000) {
                entry.validationStatus = 'REJECTED';
                entry.message = `Dangerous Dosage: ${dailyDose}mg/day of Paracetamol exceeds safe limit.`;
                return entry;
            }
        }

        // B. Completeness Check
        const completeness = [];
        if (!entry.dosage) completeness.push('Dose');
        if (!entry.frequency) completeness.push('Freq');
        if (!entry.duration) completeness.push('Duration');

        if (completeness.length > 0) {
            entry.validationStatus = 'AMBIGUOUS';
            entry.message = `Missing clinical data: ${completeness.join('/')}.`;
        }

        return entry;
    }

    calculateDailyDose(dosageStr, freqStr) {
        try {
            const mg = parseInt(dosageStr.match(/\d+/)[0]);
            let multiplier = 1;
            const f = freqStr.toLowerCase();
            if (f.includes('twice') || f.includes('bid') || f.includes('1-0-1')) multiplier = 2;
            if (f.includes('thrice') || f.includes('tds') || f.includes('1-1-1')) multiplier = 3;
            if (f.includes('4 times') || f.includes('qid')) multiplier = 4;
            if (f.includes('5 times')) multiplier = 5;
            return mg * multiplier;
        } catch (e) { return 0; }
    }

    async runGlobalChecks(report) {
        const medNames = report.medicines.map(m => m.name);
        if (medNames.length < 2) return;

        const meds = await Medicine.find({ name: { $in: medNames } });
        for (const m1 of meds) {
            for (const m2 of meds) {
                if (m1._id.equals(m2._id)) continue;
                if (m1.interactions && m1.interactions.includes(m2.name)) {
                    report.warnings.push(`DANGER: Severe interaction between ${m1.name} and ${m2.name}!`);
                    report.status = 'DANGEROUS';
                }
            }
        }
    }

    verifyAuthenticity(data, report) {
        let authScore = 0;
        if (data.doctorName && data.doctorName !== 'Not identified') authScore += 40;
        if (data.rawText && /license|reg\s?no|pzn|md|mbbs|pharmacist/i.test(data.rawText)) authScore += 40;
        if (data.rawText && /hospital|clinic|center|medical/i.test(data.rawText)) authScore += 20;

        report.doctor.isAuthentic = authScore >= 70;
        if (!report.doctor.isAuthentic) {
            report.status = 'REJECTED';
        }
    }

    extractContextField(text, pivot, pattern) {
        if (!text || !pivot) return null;
        const idx = text.toLowerCase().indexOf(pivot.toLowerCase());
        if (idx === -1) return null;
        const slice = text.substring(idx, idx + 80);
        const match = slice.match(pattern);
        return match ? match[0] : null;
    }
}

module.exports = new PrescriptionValidator();
