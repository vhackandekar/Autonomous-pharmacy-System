const Tesseract = require('tesseract.js');
const path = require('path');
const Medicine = require('../schema/Medicine');

/**
 * Advanced Prescription Analysis Agent
 * Technique: Tesseract.js Worker + Fuzzy Match + Clinical Rules Engine
 */
class PrescriptionAgent {
    constructor() {
        this.EXPIRY_DAYS = 180; // Standard 6 months
    }

    /**
     * Primary Pipeline: OCR -> Extract -> Match -> Validate
     */
    async analyzePrescription(imagePath) {
        let worker;
        try {
            const absolutePath = path.resolve(imagePath);
            console.log(`[PRESCRIPTION_AGENT] Processing: ${absolutePath}`);

            // 1. OCR EXECUTION (High fidelity worker)
            worker = await Tesseract.createWorker('eng');
            const result = await worker.recognize(absolutePath);
            const { text: rawText, confidence } = result.data;
            await worker.terminate();

            // 2. TEXT NORMALIZATION
            const normalized = this._normalize(rawText);

            // 3. FIELD EXTRACTION
            const extracted = await this._extractFields(normalized);

            // 4. CLINICAL VALIDATION ENGINE
            const validation = await this._runRules(extracted);

            return {
                confidence: Math.round(confidence),
                ...extracted,
                ...validation
            };
        } catch (error) {
            if (worker) await worker.terminate();
            console.error("[PRESCRIPTION_AGENT_ERROR]", error);
            throw error;
        }
    }

    _normalize(text) {
        return text.toLowerCase()
            .replace(/[^a-z0-9\s/.-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    async _extractFields(text) {
        // A. DATE DETECTION
        const datePattern = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})|(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/;
        const dateMatch = text.match(datePattern);
        let issuedDate = null;
        if (dateMatch) {
            issuedDate = new Date(dateMatch[0].replace(/[\/\.]/g, '-'));
            if (isNaN(issuedDate.getTime())) issuedDate = null;
        }

        // B. MEDICINE RECOGNITION (Fuzzy + Deterministic)
        const allMeds = await Medicine.find({});
        const detected = [];
        const words = text.split(' ');

        for (const med of allMeds) {
            const medName = med.name.toLowerCase();
            const regex = new RegExp(`\\b${medName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');

            if (regex.test(text)) {
                detected.push({ name: med.name, confidence: 100 });
            } else {
                // Fuzzy check for OCR errors
                for (const word of words) {
                    if (word.length > 4 && this._levenshtein(word, medName) <= 1) {
                        detected.push({ name: med.name, confidence: 85 });
                        break;
                    }
                }
            }
        }

        // C. DOSAGE & DOCTOR
        const dosagePattern = /\d+\s?(mg|g|ml|tablet|cap|dose|units)|(\d+\s?times?\s?daily)/gi;
        const dosageMatch = text.match(dosagePattern);

        return {
            detectedMedicines: [...new Set(detected.map(d => d.name))],
            dosage: dosageMatch ? dosageMatch.join(', ') : 'Not specified',
            issuedDate,
            doctorName: this._findDoctor(text)
        };
    }

    _findDoctor(text) {
        const triggers = ['dr', 'doctor', 'physician', 'hospital', 'clinic', 'specialist'];
        const words = text.split(' ');
        for (let i = 0; i < words.length; i++) {
            if (triggers.some(t => words[i].includes(t))) {
                return words.slice(i, i + 3).join(' ').trim();
            }
        }
        return 'Not identified';
    }

    _levenshtein(a, b) {
        const matrix = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
                else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
            }
        }
        return matrix[b.length][a.length];
    }

    /**
     * DYNAMIC RULES ENGINE
     * Implements Stock -> Tag -> Expiry -> Completeness
     */
    async _runRules(extracted) {
        const logs = [];
        let status = 'PENDING_ADMIN_REVIEW'; // Default to admin review for all valid matches

        // 1. INVENTORY SYNC (THE ONLY REJECTION CASE)
        if (extracted.detectedMedicines.length === 0) {
            return {
                status: 'REJECTED',
                validationNotes: 'REJECTED: No medicine recognized from prescription document.',
                medicineValidation: {
                    isValid: false,
                    reason: 'NO_MEDICINES_DETECTED',
                    detectedCount: 0
                }
            };
        }

        const med = await Medicine.findOne({ name: extracted.detectedMedicines[0] });

        // 2. STOCK VALIDATION (Log only)
        if (med && med.stock <= 0) {
            logs.push(`ALERT: ${med.name} is out of stock.`);
        }

        // 3. TAG VALIDATION (Log only)
        if (med && !med.prescriptionRequired) {
            logs.push(`NOTE: ${med.name} is OTC.`);
        }

        // 4. EXPIRY VALIDATION (Log only)
        if (extracted.issuedDate) {
            const age = Math.ceil(Math.abs(new Date() - extracted.issuedDate) / (1000 * 60 * 60 * 24));
            if (age > this.EXPIRY_DAYS) {
                logs.push(`WARN: Prescription appears expired (${age} days old).`);
            }
        } else {
            logs.push('WARN: Issued date not found.');
        }

        // 5. CLINICAL COMPLETENESS (Log only)
        if (extracted.doctorName === 'Not identified') {
            logs.push('INFO: Doctor identifier missing.');
        }

        logs.push('SYSTEM: Sent for Pharmacist verification.');

        return {
            status,
            validationNotes: logs.join(' | '),
            medicineValidation: {
                isValid: true,
                reason: 'MEDICINES_DETECTED',
                detectedCount: extracted.detectedMedicines.length
            }
        };
    }

    /**
     * NEW: Validate if requested medicine is in the prescription
     * Used to verify prescription actually mentions the medicine being verified
     */
    async validateMedicineInPrescription(medicineId, extractedMedicines) {
        try {
            // Get requested medicine details
            const requestedMedicine = await Medicine.findById(medicineId);
            if (!requestedMedicine) {
                return { isValid: false, reason: 'MEDICINE_NOT_FOUND' };
            }

            if (!extractedMedicines || extractedMedicines.length === 0) {
                return { isValid: false, reason: 'NO_MEDICINES_IN_PRESCRIPTION' };
            }

            // Exact match
            const exactMatch = extractedMedicines.some(med => 
                med.toLowerCase() === requestedMedicine.name.toLowerCase()
            );
            if (exactMatch) {
                return { isValid: true, reason: 'EXACT_MATCH', matchedMedicine: requestedMedicine.name };
            }

            // Fuzzy match (similar names - OCR errors)
            const fuzzyMatch = extractedMedicines.find(med => {
                const distance = this._levenshtein(
                    med.toLowerCase(),
                    requestedMedicine.name.toLowerCase()
                );
                return distance <= 2; // Allow up to 2 character differences
            });
            if (fuzzyMatch) {
                return { isValid: true, reason: 'FUZZY_MATCH', matchedMedicine: fuzzyMatch };
            }

            // Check alternative names / synonyms
            const altNames = requestedMedicine.alternateNames || [];
            const altMatch = extractedMedicines.some(med => 
                altNames.some(alt => alt.toLowerCase() === med.toLowerCase())
            );
            if (altMatch) {
                return { isValid: true, reason: 'ALTERNATE_NAME_MATCH', matchedMedicine: requestedMedicine.name };
            }

            // No match found
            return { 
                isValid: false, 
                reason: 'MEDICINE_MISMATCH',
                requestedMedicine: requestedMedicine.name,
                detectedMedicines: extractedMedicines
            };
        } catch (error) {
            console.error('[PRESCRIPTION_AGENT] Validation error:', error);
            return { isValid: false, reason: 'VALIDATION_ERROR', error: error.message };
        }
    }
}

module.exports = new PrescriptionAgent();
