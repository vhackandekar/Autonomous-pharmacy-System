const express = require('express');
const router = express.Router();
const multer = require('multer');
const voiceController = require('../controller/voiceController');

// Multer setup for audio
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    }
});

router.post('/stt', upload.single('audio'), voiceController.speechToText);

module.exports = router;