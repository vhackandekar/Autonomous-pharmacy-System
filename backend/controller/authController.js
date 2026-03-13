const User = require('../schema/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: "Name, email and password are required." });
        }

        // --- SERVER-SIDE STRONG VALIDATION ---
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: "Invalid email format." });
        }

        // Name: Only letters and spaces, min 2 chars
        const nameRegex = /^[A-Za-z\s]{2,}$/;
        if (!nameRegex.test(name.trim())) {
            return res.status(400).json({ error: "Name must be at least 2 characters long and contain only letters." });
        }

        // Password: Min 8 chars, 1 upper, 1 lower, 1 number, 1 special
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                error: "Password must be at least 8 characters long, include an uppercase letter, a lowercase letter, a number, and a special character."
            });
        }

        // Phone: Exactly 10 digits
        const phoneRegex = /^\d{10}$/;
        if (phone && !phoneRegex.test(phone.trim())) {
            return res.status(400).json({ error: "Phone number must be exactly 10 digits." });
        }

        // Security: Force USER role
        const roleUpper = 'USER';

        const emailNorm = email.trim().toLowerCase();
        const existing = await User.findOne({ email: new RegExp(`^${emailNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
        if (existing) {
            return res.status(400).json({ error: "This email is already registered." });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = new User({
            name: name.trim(),
            email: emailNorm,
            password: hashedPassword,
            phone: phone || '',
            role: roleUpper,
            isVerified: true
        });
        await user.save();

        res.status(201).json({
            message: "User registered successfully",
            userId: user._id,
            email: user.email,
        });
    } catch (error) {
        console.error("Registration Error:", error);
        res.status(400).json({ error: error.message || "Registration failed." });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        // --- SERVER-SIDE VALIDATION ---
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: "Invalid email format." });
        }

        // --- STATIC ADMIN LOGIN ---
        if (email.trim().toLowerCase() === 'admin@pharmacy.com' && password === 'Admin@123') {
            const token = jwt.sign(
                { id: '000000000000000000000000', role: 'ADMIN' },
                process.env.JWT_SECRET,
                { expiresIn: '1d' }
            );
            return res.json({
                message: "Admin Login successful",
                token,
                user: {
                    id: '000000000000000000000000',
                    name: 'Pharmacy Admin',
                    email: 'admin@pharmacy.com',
                    role: 'ADMIN'
                }
            });
        }

        const user = await User.findOne({ email: email.trim().toLowerCase() });
        if (!user) return res.status(401).json({ error: "Invalid credentials" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

        // JWT for session management
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
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

        // Validation for name update
        if (updates.name) {
            const nameRegex = /^[A-Za-z\s]{2,}$/;
            if (!nameRegex.test(updates.name.trim())) {
                return res.status(400).json({ error: "Name must be at least 2 characters long and contain only letters." });
            }
            updates.name = updates.name.trim();
        }

        // Validation for phone update
        if (updates.phone) {
            const phoneRegex = /^\d{10}$/;
            if (!phoneRegex.test(updates.phone.trim())) {
                return res.status(400).json({ error: "Phone number must be exactly 10 digits." });
            }
            updates.phone = updates.phone.trim();
        }

        // Validation for address fields
        if (updates.address1 && updates.address1.trim().length === 0) {
            return res.status(400).json({ error: "Address Line 1 cannot be empty." });
        }
        if (updates.city && updates.city.trim().length === 0) {
            return res.status(400).json({ error: "City cannot be empty." });
        }
        if (updates.state && updates.state.trim().length === 0) {
            return res.status(400).json({ error: "State cannot be empty." });
        }
        if (updates.pin) {
            const pinRegex = /^\d{6}$/;
            if (!pinRegex.test(updates.pin.trim())) {
                return res.status(400).json({ error: "PIN Code must be exactly 6 digits." });
            }
            updates.pin = updates.pin.trim();
        }

        // Validation for preferences
        if (updates.theme && !['light', 'dark'].includes(updates.theme)) {
            return res.status(400).json({ error: "Invalid theme value." });
        }
        if (updates.language && (typeof updates.language !== 'string' || updates.language.length > 50)) {
            return res.status(400).json({ error: "Invalid language format." });
        }
        if (updates.voiceMode !== undefined && typeof updates.voiceMode !== 'boolean') {
            return res.status(400).json({ error: "Invalid voice mode value." });
        }

        // Remove sensitive fields if present to prevent unauthorized elevation
        delete updates.password;
        delete updates.role;
        delete updates.email; // Usually emails shouldn't be changed via profile update without extra verification

        const user = await User.findByIdAndUpdate(userId, updates, { new: true }).select('-password');
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
