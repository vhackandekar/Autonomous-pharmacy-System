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

    async processMessage(userMessage, chatHistory, orderHistory, availableMedicines, userPrescriptions, userCart, userName, parentTrace = null, sessionId = null) {
        const langfuse = require('../utils/langfuseClient');
        const span = parentTrace ? parentTrace.span({
            name: "Conversational-Agent-Brain",
            input: { userMessage, userName },
            metadata: { sessionId }
        }) : null;

        let lastError = "";
        const prompt = `
# ROLE
You are Dr. Saahil, a Licensed Expert AI Pharmacist. Use clinical precision and deep empathy.

# KNOWLEDGE BASE (TRUSTED DATA ONLY)
- User: ${userName}
- Available Inventory: ${JSON.stringify(availableMedicines.map(m => ({ name: m.name, price: m.price, stock: m.stock })))}
- Current Cart: ${JSON.stringify(userCart)}
- Past Orders: ${JSON.stringify(orderHistory)}
- User Prescriptions: ${JSON.stringify(userPrescriptions.map(p => ({ medicine: p.medicineId.name, status: p.status, expiry: p.validTill })))}
- History: ${JSON.stringify(chatHistory.slice(-6))}
- User Message: "${userMessage}"

# REASONING PROTOCOL (THINK BEFORE ANSWERING)
1. **Analyze Intent**: What is the user trying to do? (Price? Buy? Confirm? Notify?)
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

# EXAMPLE (THE NEW FLOW)
1. User: "Order 5 Aspirins"
   AI: { "intent": "ORDER_MEDICINE", "answer": "The price for 5 Aspirin is 50. Shall I place this order?", ... }

2. User: "Yes"
   AI: { "intent": "CONFIRM_ORDER", "requiresDosage": true, "dosageOptions": [...], "answer": "Before I finalize your order, clinical protocol requires you to select your prescribed schedule:", ... }

3. User: [Selects dosage from dropdown]
   AI: { "intent": "CONFIRM_ORDER", "requiresDosage": false, "answer": "Order placed! I've recorded your schedule as 1 tablet a day.", ... }
`;

        // --- MODEL CHAIN ---
        let finalResponse = null;

        // 1. Primary: Groq Llama 3.3 70b
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

    async translateMessage(message, targetLanguage) {
        if (!targetLanguage || targetLanguage.toLowerCase() === 'english') return message;

        const prompt = `Translate the following pharmacy-related message into ${targetLanguage}. 
        Keep medicine names and technical numbers as they are. 
        Return ONLY the translated text, no explanation.
        Message: "${message}"`;

        if (this.groq) {
            try {
                const completion = await this.groq.chat.completions.create({
                    messages: [{ role: "user", content: prompt }],
                    model: "llama-3.3-70b-versatile",
                });
                return completion.choices[0].message.content.trim();
            } catch (e) {
                console.error("Groq Translation Failed:", e.message);
            }
        }

        if (this.geminiModel) {
            try {
                const result = await this.geminiModel.generateContent(prompt);
                return result.response.text().trim();
            } catch (e) {
                console.error("Gemini Translation Failed:", e.message);
            }
        }

        return message; // Fallback to original
    }
}

module.exports = new ConversationalAgent();
