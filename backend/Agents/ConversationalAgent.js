const { GoogleGenerativeAI } = require("@google/generative-ai");
const Groq = require("groq-sdk");
const dotenv = require("dotenv");

dotenv.config()

class ConversationalAgent {
    constructor() {
        // Initialize Gemini
        if (process.env.GEMINI_API_KEY) {
            this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            // Use latest stable model without apiVersion parameter
            this.geminiModel = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" }, { apiVersion: "v1" });
        }

        // Initialize Groq
        if (process.env.GROQ_API_KEY) {
            this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        }

        // Thiollama Setup (OpenAI compatible)
        this.thiollamaKey = process.env.THIOLLAMA_API_KEY;
        this.thiollamaBaseUrl = "https://api.thiollama.com/v1";

        // Sarvam AI (Indic Language Translation)
        this.sarvamKey = process.env.SARVAM_API_KEY || process.env.SPEECH_TO_TEXT_API;
        this.sarvamBaseUrl = "https://api.sarvam.ai";
    }

    _stripAndParse(text) {
        if (!text || typeof text !== 'string') return null;
        try {
            const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleaned);
        } catch (e) {
            return null;
        }
    }

    _isValidResponse(obj) {
        if (!obj || typeof obj !== 'object') return false;
        if (!obj.intent || typeof obj.answer !== 'string') return false;
        if (typeof obj.confidence !== 'number') return false;
        if (!Array.isArray(obj.items)) obj.items = [];
        return true;
    }

    async processMessage(userMessage, chatHistory, orderHistory, availableMedicines, userPrescriptions, userCart, userName, parentTrace = null, sessionId = null, userLanguage = 'English') {
        const langfuse = require('../utils/langfuseClient');
        const span = parentTrace ? parentTrace.span({
            name: "Conversational-Agent-Brain",
            input: { userMessage, userName, userLanguage },
            metadata: { sessionId }
        }) : null;
        // ... (lines 56-57 remain same)
        const prompt = `
# ROLE
You are Dr. Saahil, a Licensed Expert AI Pharmacist. Use clinical precision and deep empathy.

# LANGUAGE PARITY
The user's preferred language is ${userLanguage}.
- You MUST respond STRICTLY in the script of ${userLanguage}.
- If ${userLanguage} is Marathi, your 'answer' field MUST be in Marathi script (Devanagari).
- If ${userLanguage} is Hindi, use Hindi script (Devanagari).
- Never use English translations or Latin script for Indic languages unless specifically asked.
- Only use English if ${userLanguage} is English.
- Your entire JSON 'answer' field content must be in ${userLanguage}.

# KNOWLEDGE BASE (TRUSTED DATA ONLY)
- User: ${userName}
- Available Inventory: ${JSON.stringify(availableMedicines.map(m => ({ name: m.name, price: m.price, stock: m.stock })))}
- Current Cart: ${JSON.stringify(userCart)}
- Past Orders: ${JSON.stringify(orderHistory)}
- User Prescriptions: ${JSON.stringify(userPrescriptions.map(p => ({ medicine: p.medicineId.name, status: p.status, expiry: p.validTill })))}
- History: ${JSON.stringify(chatHistory.slice(-6))}
- User Message (Translated to English for processing): "${userMessage}"

# REASONING PROTOCOL (THINK BEFORE ANSWERING)
1. **Analyze Intent**: What is the user trying to do? 
   - **Ordering (Immediate)**: If user says "Buy", "Order", "Purchase", "I want", "Give me", use intent 'ORDER_MEDICINE'.
   - **Shopping (Cart)**: If user says "Add to cart", "Put in basket", "Save to cart", use intent 'ADD_TO_CART'.
2. **Context Awareness**:
   - If the user says "Yes", "Confirm", "Sure", etc., look at the IMMEDIATELY PREVIOUS message from the Assistant in the History. 
   - If the Assistant previously asked "should I notify you about [Medicine]?", and the user says "Yes", then the intent is 'NOTIFY_STOCK' and the medicine is [Medicine].
3. **Clinical Protocol (MANDATORY)**: 
   - **PHASE 1 (Price & Quantity)**: When a user asks for a price or says "Order [Med]", provide the price summary.
     - **ABSENT FROM SYSTEM**: If the medicine name (or a common synonym) is NOT in the available inventory at all:
       - Intent: 'FALLBACK'
       - Answer: "I'm sorry, we don't carry [Medicine] in our pharmacy. However, I can check for alternatives or help with something else?"
     - **IF MEDICINE IS OUT OF STOCK**: 
       - Intent: 'GENERAL_QUERY'
       - Answer: "Currently, [Medicine] is out of stock. Whenever the medicine is available in stock should I notify you?"
       - **MANDATORY**: Use the IDENTICAL medicine name from the user's request. 
       - **Synonyms**: Recognize 'Advil' as 'Ibuprofen', 'Tylenol' as 'Paracetamol', etc., based on inventory.
   
   - **PHASE 2 (Notifications & Confirmations)**:
     - **IF USER CONFIRMS NOTIFICATION**: 
       - Intent: 'NOTIFY_STOCK'
       - **MANDATORY**: You MUST include the medicine name in the items array.
       - items: [{"medicine_name": "[Medicine Name from previous message]", "quantity": 1}]
       - Answer: "Ok, I will notify you once [Medicine Name] is in stock!"
       - **STRICT RULE**: Do NOT hallucinate names. If user said "Advil" and your inventory has "Ibuprofen", use "Ibuprofen" in the items array but "Advil" in the answer if you wish.

   - **PHASE 3 (Order Placement & Dosage)**: 
     - When a user says "Yes" or "Confirm" to an order:
       - **IF SCHEDULE IS MISSING**:
         - Set requiresDosage: true.
         - Provide dosageOptions: ["1 tablet one day", "2 tablets 1 day", "3 tablet one day", "As directed by physician"].
         - Your answer MUST start with: "Before I finalize your order, clinical protocol requires you to select your prescribed schedule:"
       - **IF SCHEDULE IS PROVIDED**:
         - Intent: 'CONFIRM_ORDER'
         - Answer: "Perfect! I've placed your order for [Medicine]. Predicted dosage: [Schedule]."

4. **Clinical Safety (PRESCRIPTIONS)**: 
   - Before suggesting "Shall I add this?", check if the item requires a prescription.
   - If user has NO prescription, explain requirements.

# OPERATIONAL RULES
- Respond ONLY in the language the user is speaking.
- **Strict Logic**: If requiresDosage is true, your answer MUST ONLY ask for the schedule.
- **Out of Stock**: Use intent 'NOTIFY_STOCK' ONLY when user says "Yes" to a notification offer.
- **NO RANDOM MEDICINES**: Never mention a medicine name not present in the current conversation or inventory.

# OUTPUT FORMAT (STRICT JSON)
{
  "thought_process": "Briefly state your internal reasoning here",
  "intent": "ORDER_MEDICINE | CONFIRM_ORDER | ORDER_PAYMENT | ADD_TO_CART | REMOVE_FROM_CART | SYMPTOM_QUERY | NOTIFY_STOCK | FALLBACK",
  "answer": "Professional, human-like response.",
  "total_price": number,
  "items": [{ "medicine_name": "string", "quantity": number, "dosage": "string" }],
  "requiresDosage": boolean,
  "dosageOptions": ["Option A", "Option B"],
  "confidence": 0.95
}

# EXAMPLES
1. User: "Order 5 Aspirins"
   AI: { "intent": "ORDER_MEDICINE", "answer": "The price for 5 Aspirin is 50. Shall I place this order?", ... }

2. User: "Add Paracetamol to my cart"
   AI: { "intent": "ADD_TO_CART", "answer": "I've added Paracetamol to your cart. You can review it anytime.", ... }

3. User: "Yes" (after order summary)
   AI: { "intent": "CONFIRM_ORDER", "requiresDosage": true, "dosageOptions": [...], "answer": "Before I finalize your order, clinical protocol requires you to select your prescribed schedule:", ... }
`;

        // --- MODEL CHAIN ---
        let finalResponse = null;

        const axios = require('axios');

        // 0. Priority One: Thiollama
        if (this.thiollamaKey) {
            try {
                const generation = span ? span.generation({ name: "Thiollama-Primary", model: "llama-3.1-70b-instruct", input: prompt }) : null;
                const response = await axios.post(`${this.thiollamaBaseUrl}/chat/completions`, {
                    messages: [{ role: "user", content: prompt }],
                    model: "llama-3.1-70b-instruct",
                    response_format: { type: "json_object" }
                }, {
                    headers: { 'Authorization': `Bearer ${this.thiollamaKey}` }
                });

                let parsed = this._stripAndParse(response.data.choices[0].message.content);
                if (this._isValidResponse(parsed)) {
                    if (generation) generation.end({ output: parsed });
                    finalResponse = parsed;
                }
            } catch (e) { console.warn("Thiollama Primary Failed", e.response?.data || e.message); }
        }

        // 1. Secondary: Groq Llama 3.3 70b
        if (this.groq) {
            try {
                const generation = span ? span.generation({ name: "Groq-70b-Primary", model: "llama-3.3-70b-versatile", input: prompt }) : null;
                const chatCompletion = await this.groq.chat.completions.create({
                    messages: [{ role: "user", content: prompt }],
                    model: "llama-3.3-70b-versatile",
                    response_format: { type: "json_object" }
                });

                let parsed = this._stripAndParse(chatCompletion.choices[0].message.content);
                if (this._isValidResponse(parsed)) {
                    if (generation) generation.end({ output: parsed });
                    finalResponse = parsed;
                }
            } catch (e) { console.warn("Groq Primary Failed", e.message); }
        }

        // 2. Fallback: Gemini
        if (!finalResponse && this.geminiModel) {
            try {
                const generation = span ? span.generation({ name: "Gemini-Fallback", model: "gemini-2.0-flash", input: prompt }) : null;
                const result = await this.geminiModel.generateContent(prompt);
                const response = await result.response;
                let parsed = this._stripAndParse(response.text());
                if (this._isValidResponse(parsed)) {
                    if (generation) generation.end({ output: parsed });
                    finalResponse = parsed;
                }
            } catch (e) { console.warn("Gemini Fallback Failed", e.message); }
        }

        // Default Fallback
        if (!finalResponse) {
            finalResponse = {
                intent: "FALLBACK",
                answer: "I'm having a technical moment. Could you try again?",
                items: [],
                confidence: 0
            };
        }

        if (span) span.end({ output: finalResponse });
        return finalResponse;
    }

    async translateMessage(message, target, source = 'English') {
        if (!message) return "";
        if (target.toLowerCase() === source.toLowerCase()) return message;

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

        const targetCode = langMap[target.toLowerCase()];
        const sourceCode = langMap[source.toLowerCase()];

        if (targetCode === sourceCode) return message;

        // 1. Try Sarvam AI (Indic Specialized)
        if (this.sarvamKey && targetCode && sourceCode && (targetCode !== 'en-IN' || sourceCode !== 'en-IN')) {
            try {
                const axios = require('axios');
                const response = await axios.post(`${this.sarvamBaseUrl}/translate`, {
                    input: message,
                    source_language_code: sourceCode,
                    target_language_code: targetCode,
                    speaker_gender: "Male",
                    mode: "formal"
                }, {
                    headers: { 'api-subscription-key': this.sarvamKey }
                });

                if (response.data && response.data.translated_text) {
                    return response.data.translated_text;
                }
            } catch (e) {
                console.warn(`Sarvam Translation Failed (${source} -> ${target}):`, e.response?.data || e.message);
            }
        }

        // 2. Fallback to LLM-based translation (for non-Indic or if Sarvam fails)
        const prompt = `Translate the following message from ${source} to ${target}. 
        Return ONLY the translated text. Do not add explanations.
        Message: "${message}"`;

        const axios = require('axios');
        if (this.thiollamaKey) {
            try {
                const response = await axios.post(`${this.thiollamaBaseUrl}/chat/completions`, {
                    messages: [{ role: "user", content: prompt }],
                    model: "llama-3.1-70b-instruct"
                }, {
                    headers: { 'Authorization': `Bearer ${this.thiollamaKey}` }
                });
                return response.data.choices[0].message.content.trim();
            } catch (e) { }
        }

        if (this.groq) {
            try {
                const completion = await this.groq.chat.completions.create({
                    messages: [{ role: "user", content: prompt }],
                    model: "llama-3.3-70b-versatile"
                });
                return completion.choices[0].message.content.trim();
            } catch (e) { }
        }

        if (this.geminiModel) {
            try {
                const result = await this.geminiModel.generateContent(prompt);
                return result.response.text().trim();
            } catch (e) { }
        }

        return message; // Final fallback
    }
}

module.exports = new ConversationalAgent();
