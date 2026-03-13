const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String },
    password: { type: String, required: true },
    role: { type: String, enum: ['USER', 'ADMIN'], default: 'USER' },
    address1: { type: String },
    address2: { type: String },
    city: { type: String },
    state: { type: String },
    pin: { type: String },
    theme: { type: String, enum: ['light', 'dark'], default: 'light' },
    language: { type: String, default: 'English' },
    voiceMode: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
