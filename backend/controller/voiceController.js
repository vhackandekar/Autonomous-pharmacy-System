const axios = require('axios');
const FormData = require('form-data');

exports.speechToText = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No audio file provided" });
        }

        const apiKey = process.env.SPEECH_TO_TEXT_API;
        if (!apiKey) {
            console.error("[VOICE_CONTROLLER] Sarvam API key missing in .env");
            return res.status(500).json({ error: "Voice integration not configured" });
        }

        const formData = new FormData();
        formData.append('file', req.file.buffer, {
            filename: 'audio.webm', // MediaRecorder usually sends webm
            contentType: req.file.mimetype,
        });
        formData.append('model', 'saaras:v3'); // Updated to latest supported version
        // formData.append('language_code', 'hi-IN'); // Optional: can be auto-detected or passed from frontend

        console.log(`[VOICE_CONTROLLER] Sending audio to Sarvam AI... (${req.file.size} bytes)`);

        const response = await axios.post('https://api.sarvam.ai/speech-to-text', formData, {
            headers: {
                ...formData.getHeaders(),
                'api-subscription-key': apiKey
            }
        });

        console.log("[VOICE_CONTROLLER] Sarvam Response:", response.data);

        return res.json({
            transcript: response.data.transcript || response.data.text || "",
            language: response.data.language_code || "unknown",
            confidence: response.data.confidence || 1.0
        });

    } catch (error) {
        console.error("[VOICE_CONTROLLER_ERROR]", error.response?.data || error.message);
        return res.status(500).json({
            error: "Failed to process audio",
            details: error.response?.data || error.message
        });
    }
};