const User = require('../schema/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
    try {
        const { name, email, password, phone, role } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: "Name, email and password are required." });
        }

        // Security: Default to USER and do NOT allow setting ADMIN role via public registration
        const roleUpper = 'USER';

        const emailNorm = email.trim().toLowerCase();
        const existing = await User.findOne({ email: new RegExp(`^${emailNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
        if (existing) {
            return res.status(400).json({ error: "This email is already registered. Please login or use a different email." });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = new User({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password: hashedPassword,
            phone: phone || '',
            role: roleUpper
        });
        await user.save();
        res.status(201).json({ message: "User registered successfully", userId: user._id });
    } catch (error) {
        console.error("Registration Error:", error);
        if (error.code === 11000) {
            return res.status(400).json({ error: "This email is already registered. Please login or use a different email." });
        }
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message || "Validation failed." });
        }
        res.status(400).json({ error: error.message || "Registration failed." });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        const user = await User.findOne({ email });

        if (!user) return res.status(401).json({ error: "Invalid credentials" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

        // JWT for FR-16 session management
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '1d' }
        );

        res.json({
            message: "Login successful",
            token,
            user: { id: user._id, name: user.name, role: user.role }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId).select('-password');
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const updates = req.body;

        // Remove sensitive fields if present
        delete updates.password;
        delete updates.role;
        delete updates.email;

        const user = await User.findByIdAndUpdate(userId, updates, { new: true }).select('-password');
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
