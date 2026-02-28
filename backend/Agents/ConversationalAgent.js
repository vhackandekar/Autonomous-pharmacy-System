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
1. **Analyze Intent**: Is the user asking a new question, confirming an order, or asking about history?
2. **Consult Data**: Is the medicine mentioned in the "Available Inventory"? If NOT, do not hallucinate a price.
3. **Check Context**: If the user says "Yes", did I just provide a price summary in the history?
4. **Clinical Safety (PRESCRIPTIONS)**: 
   - Before suggesting "Shall I add this?", check if the item requires a prescription in Available Inventory.
   - If user has NO prescription: "A prescription is required for this. You can upload it here directly using the paperclip icon 📎 or via the Prescription Portal in the sidebar."
   - If prescription status is 'AI_APPROVED': "Great news! I've pre-analyzed your prescription and it looks correct. Our pharmacist is doing a final validation right now, and you'll be able to order soon!"
   - If prescription status is 'PENDING': "I'm currently reviewing your prescription (Verification in progress). I'll let you know as soon as our human pharmacist confirms it!"
   - If prescription status is 'REJECTED': "I'm sorry, the prescription you uploaded was rejected by our panel. Reason: [See Prescription Portal]. Please upload a valid, clear copy."
   - If prescription status is 'EXPIRED': "Your prescription for this has expired. You'll need to upload a fresh one via the 📎 icon."
   - DO NOT return 'ADD_TO_CART' or 'ORDER_PAYMENT' intent for medicines requiring a prescription if the user doesn't have a 'VERIFIED' one. Return 'FALLBACK' instead.

# OPERATIONAL RULES
- Respond ONLY in the language the user is speaking (English/Hindi/etc).
- If a medicine is not in inventory, say: "I'm sorry, we don't carry [Name] at the moment."
- **2-Step Workflow**:
    - First, provide the price and ask "Shall I place this order?" (ORDER_MEDICINE)
    - Second, only place it if they say "Yes/Confirm" (ORDER_PAYMENT)
- If user input is not understandable and confusing, ask follow-up questions to clear the doubt and try to understand the user requirement and then respond.

# OUTPUT FORMAT (STRICT JSON)
{
  "thought_process": "Briefly state your internal reasoning here",
  "intent": "ORDER_MEDICINE | ORDER_PAYMENT | ADD_TO_CART | REMOVE_FROM_CART | SYMPTOM_QUERY | FALLBACK",
  "answer": "Professional, human-like response.",
  "total_price": number,
  "items": [{ "medicine_name": "string", "quantity": number }],
  "confidence": 0.95
}

# EXAMPLE (REMOVE FROM CART)
User: "Actually, remove the Dolo from my cart."
AI: { "intent": "REMOVE_FROM_CART", "thought_process": "User wants to remove a specific item from their cart.", "answer": "No problem! I've removed Dolo 650 from your cart. Is there anything else you'd like to change?", "items": [{ "medicine_name": "Dolo" }] }
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
