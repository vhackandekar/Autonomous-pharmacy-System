const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const Groq = require("groq-sdk");
const Medicine = require('../schema/Medicine');

/**
 * AGENT: Advanced Prescription Validation Specialist
 * TECHNIQUE: Hybrid Pipeline (Local AI OCR + Cloud Vision LLM + Clinical NLP)
 */
class PrescriptionAgent {
    constructor() {
        if (process.env.GROQ_API_KEY) {
            this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        }
    }

    async analyzePrescription(imagePath, userId = null, parentTrace = null) {
        const absolutePath = path.resolve(imagePath);
        console.log(`[ADVANCED_AGENT] Starting Pipeline for: ${absolutePath}`);

        try {
            // STEP 1-4: Image Enhancement -> Detection -> Recognition (Local Python Service)
            let ocrData = { raw_text: '', confidence: 0 };
            try {
                ocrData = await this._getPythonAI(absolutePath);
            } catch (err) {
                console.warn("[ADVANCED_AGENT] Local AI Service offline, falling back to Tesseract.js");
                const worker = await Tesseract.createWorker('eng');
                const result = await worker.recognize(absolutePath);
                ocrData = { raw_text: result.data.text, confidence: result.data.confidence / 100 };
                await worker.terminate();
            }

            // STEP 5: Vision-Language Model (Document Understanding via Groq Vision)
            let documentUnderstanding = "";
            if (this.groq) {
                try {
                    const imageBuffer = fs.readFileSync(absolutePath);
                    const base64Image = imageBuffer.toString('base64');
                    const mimeType = imagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

                    const visionResponse = await this.groq.chat.completions.create({
                        messages: [
                            {
                                role: "user",
                                content: [
                                    { type: "text", text: "Read this medical prescription. Detect medicines, dosages, and doctor info even if handwritten. Respond with the extracted text." },
                                    { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } }
                                ]
                            }
                        ],
                        model: "meta-llama/llama-4-scout-17b-16e-instruct",
                    });
                    documentUnderstanding = visionResponse.choices[0].message.content;
                } catch (vErr) {
                    console.error("[ADVANCED_AGENT] Vision LLM failed:", vErr.message);
                }
            }

            // STEP 6: Medical Entity Extraction (NLP via Groq)
            const combinedText = `OCR_TEXT: ${ocrData.raw_text}\nVISION_ANALYSIS: ${documentUnderstanding}`;
            const medicalData = await this._extractMedicalEntities(combinedText);

            // STEP 7-8: Drug Validation & Confidence Scoring
            const validation = await this._runClinicalValidation({ ...medicalData, rawText: combinedText }, ocrData.confidence);

            return {
                ...medicalData,
                ...validation,
                raw_text: combinedText
            };

        } catch (error) {
            console.error("[ADVANCED_AGENT_CRITICAL_FAILURE]", error);
            throw error;
        }
    }

    async _extractMedicalEntities(text) {
        if (!this.groq) {
            return { detectedMedicines: [], dosage: "N/A", doctorName: "Unknown" };
        }

        const allMeds = await Medicine.find({}, 'name');
        const medList = allMeds.map(m => m.name).join(', ');

        const prompt = `You are a medical NLP specialist. Extract entities from this messy prescription text.
        TEXT: "${text}"
        VALID MEDICINES IN OUR PHARMACY: ${medList}
        
        Return ONLY valid JSON:
        {
            "detectedMedicines": ["Name1", "Name2"],
            "dosage": "string",
            "doctorName": "string",
            "patientName": "string",
            "issuedDate": "YYYY-MM-DD",
            "clinicalFindings": "Any symptoms or diagnosis mentioned"
        }`;

        try {
            const result = await this.groq.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "llama-3.3-70b-versatile",
                response_format: { type: "json_object" }
            });
            const data = JSON.parse(result.choices[0].message.content);

            // Date Normalization to prevent Mongoose Cast Errors
            if (data.issuedDate) {
                const parsedDate = new Date(data.issuedDate);
                if (isNaN(parsedDate.getTime())) {
                    data.issuedDate = null;
                } else {
                    data.issuedDate = parsedDate.toISOString().split('T')[0];
                }
            } else {
                data.issuedDate = null;
            }

            return data;
        } catch (e) {
            console.error("NLP Extraction Failed:", e);
            return { detectedMedicines: [], dosage: "N/A", doctorName: "Unknown", issuedDate: null };
        }
    }

    async _runClinicalValidation(entities, ocrConfidence) {
        const validator = require('../utils/PrescriptionValidator');
        const report = await validator.validate(entities, ocrConfidence * 100);

        let finalStatus = report.status;
        if (report.status === 'ACCEPTED') finalStatus = 'VERIFIED';
        if (report.status === 'PHARMACIST_REVIEW_REQUIRED') finalStatus = 'PENDING_ADMIN_REVIEW';

        let notes = report.reason || report.warnings.join(' | ') || 'Prescription clinically verified.';

        return {
            status: finalStatus,
            validationNotes: notes,
            structuredData: report,
            confidence: Math.round(ocrConfidence * 100)
        };
    }

    async validateMedicineInPrescription(medicineId, extractedMedicines) {
        try {
            const requestedMedicine = await Medicine.findById(medicineId);
            if (!requestedMedicine) return { isValid: false, reason: 'MEDICINE_NOT_FOUND' };

            const requestedName = requestedMedicine.name.toLowerCase();
            const extractedNames = (extractedMedicines || []).map(m => m.toLowerCase());
            const altNames = (requestedMedicine.alternateNames || []).map(a => a.toLowerCase());

            const isMatch = extractedNames.some(ext =>
                ext === requestedName ||
                altNames.includes(ext)
            );

            return {
                isValid: isMatch,
                reason: isMatch ? 'SUCCESS' : 'MEDICINE_NOT_MENTIONED',
                target: requestedMedicine.name,
                detectedMedicines: extractedMedicines
            };
        } catch (error) {
            console.error('[MEDICINE_VALIDATION_ERROR]', error);
            return { isValid: false, reason: 'VALIDATION_FAILED' };
        }
    }

    async _getPythonAI(imagePath) {
        const formData = new FormData();
        formData.append('file', fs.createReadStream(imagePath));
        const res = await axios.post('http://localhost:8000/process-prescription', formData, {
            headers: { ...formData.getHeaders() },
            timeout: 60000
        });
        return res.data;
    }
}

module.exports = new PrescriptionAgent();
