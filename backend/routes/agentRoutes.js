const express = require('express');
const router = express.Router();
const agentController = require('../controller/agentController');
const { verifyToken } = require('../middleware/auth');

const multer = require('multer');
const path = require('path');

// File type whitelist for prescriptions
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mimetype = file.mimetype.toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(ext) || !ALLOWED_FILE_TYPES.includes(mimetype)) {
        return cb(new Error(`Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`), false);
    }
    cb(null, true);
};

// Multer Config with file validation
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 25 * 1024 * 1024 } // Increased to 25MB limit
});

// Enhanced error handler for multer file validation
const uploadHandler = (req, res, next) => {
    upload.single('prescription')(req, res, (err) => {
        if (err) {
            console.error('Multer upload error:', err);
            // Handle different error types
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'File size exceeds 25MB limit' });
            }
            if (err.code === 'LIMIT_PART_COUNT') {
                return res.status(400).json({ error: 'Too many parts in request' });
            }
            if (err.code === 'LIMIT_FILE_COUNT') {
                return res.status(400).json({ error: 'Too many files' });
            }
            return res.status(400).json({ error: err.message || 'File upload failed' });
        }
        if (!req.file && req.method === 'POST') {
            // Let the controller handle missing file
            return next();
        }
        next();
    });
};

// Multer Config for audio (STT)
const audioStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, 'voice-' + Date.now() + path.extname(file.originalname));
    }
});

const audioUpload = multer({
    storage: audioStorage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB for audio
});

router.post('/chat', verifyToken, agentController.chat);
router.post('/chat/upload', verifyToken, uploadHandler, agentController.chatUpload);
router.post('/stt', verifyToken, audioUpload.single('audio'), agentController.speechToText);
router.get('/logs', verifyToken, agentController.getLogs);

module.exports = router;
