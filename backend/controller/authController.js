const User = require('../schema/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const ErrorHandler = require('../utils/ErrorHandler');
const asyncHandler = require('../utils/asyncHandler');

exports.register = asyncHandler(async (req, res, next) => {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
        return next(new ErrorHandler("Name, email and password are required.", 400));
    }

    // --- SERVER-SIDE STRONG VALIDATION ---
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return next(new ErrorHandler("Invalid email format.", 400));
    }

    // Name: Only letters and spaces, min 2 chars
    const nameRegex = /^[A-Za-z\s]{2,}$/;
    if (!nameRegex.test(name.trim())) {
        return next(new ErrorHandler("Name must be at least 2 characters long and contain only letters.", 400));
    }

    // Password: Min 8 chars, 1 upper, 1 lower, 1 number, 1 special
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
        return next(new ErrorHandler("Password must be at least 8 characters long, include an uppercase letter, a lowercase letter, a number, and a special character.", 400));
    }

    // Phone: Exactly 10 digits
    const phoneRegex = /^\d{10}$/;
    if (phone && !phoneRegex.test(phone.trim())) {
        return next(new ErrorHandler("Phone number must be exactly 10 digits.", 400));
    }

    // Security: Force USER role
    const roleUpper = 'USER';

    const emailNorm = email.trim().toLowerCase();
    const existing = await User.findOne({ email: new RegExp(`^${emailNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
    if (existing) {
        return next(new ErrorHandler("This email is already registered.", 400));
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
        success: true,
        data: {
            message: "User registered successfully",
            userId: user._id,
            email: user.email,
        }
    });
});

exports.login = asyncHandler(async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return next(new ErrorHandler("Email and password are required", 400));
    }

    // --- SERVER-SIDE VALIDATION ---
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return next(new ErrorHandler("Invalid email format.", 400));
    }


    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
        return next(new ErrorHandler("Invalid email or password", 401));
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return next(new ErrorHandler("Invalid email or password", 401));
    }

    // JWT for session management
    const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
    );

    const userProfile = user.toObject();
    delete userProfile.password;

    res.json({
        success: true,
        data: {
            message: "Login successful",
            token,
            user: userProfile
        }
    });
});

exports.getProfile = asyncHandler(async (req, res, next) => {
    const userId = req.user.id;
    const user = await User.findById(userId).select('-password');
    if (!user) {
        return next(new ErrorHandler("User not found", 404));
    }
    res.json({
        success: true,
        data: { user }
    });
});

exports.updateProfile = asyncHandler(async (req, res, next) => {
    const userId = req.user.id;
    const updates = req.body;

    // Validation for name update
    if (updates.name) {
        const nameRegex = /^[A-Za-z\s]{2,}$/;
        if (!nameRegex.test(updates.name.trim())) {
            return next(new ErrorHandler("Name must be at least 2 characters long and contain only letters.", 400));
        }
        updates.name = updates.name.trim();
    }

    // Validation for phone update
    if (updates.phone) {
        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(updates.phone.trim())) {
            return next(new ErrorHandler("Phone number must be exactly 10 digits.", 400));
        }
        updates.phone = updates.phone.trim();
    }

    // Validation for address fields
    if (updates.address1 && updates.address1.trim().length === 0) {
        return next(new ErrorHandler("Address Line 1 cannot be empty.", 400));
    }
    if (updates.city && updates.city.trim().length === 0) {
        return next(new ErrorHandler("City cannot be empty.", 400));
    }
    if (updates.state && updates.state.trim().length === 0) {
        return next(new ErrorHandler("State cannot be empty.", 400));
    }
    if (updates.pin) {
        const pinRegex = /^\d{6}$/;
        if (!pinRegex.test(updates.pin.trim())) {
            return next(new ErrorHandler("PIN Code must be exactly 6 digits.", 400));
        }
        updates.pin = updates.pin.trim();
    }

    // Validation for preferences
    if (updates.theme && !['light', 'dark'].includes(updates.theme)) {
        return next(new ErrorHandler("Invalid theme value.", 400));
    }
    if (updates.language && (typeof updates.language !== 'string' || updates.language.length > 50)) {
        return next(new ErrorHandler("Invalid language format.", 400));
    }
    if (updates.voiceMode !== undefined && typeof updates.voiceMode !== 'boolean') {
        return next(new ErrorHandler("Invalid voice mode value.", 400));
    }

    // Remove sensitive fields if present to prevent unauthorized elevation
    delete updates.password;
    delete updates.role;
    delete updates.email;

    const user = await User.findByIdAndUpdate(userId, updates, { new: true }).select('-password');
    if (!user) {
        return next(new ErrorHandler("User not found", 404));
    }

    res.json({
        success: true,
        data: {
            message: "Profile updated successfully",
            user
        }
    });
});

exports.changePassword = asyncHandler(async (req, res, next) => {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(userId);
    if (!user) {
        return next(new ErrorHandler("User not found", 404));
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
        return next(new ErrorHandler("Current password does not match our records.", 400));
    }

    // Validate new password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
        return next(new ErrorHandler("New password must be at least 8 characters long, include an uppercase letter, a lowercase letter, a number, and a special character.", 400));
    }

    // Hash and save new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.status(200).json({
        success: true,
        data: { message: "Password updated successfully." }
    });
});

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email: email.toLowerCase().trim() });

        if (!user) {
            // Generous message to avoid account enumeration (standard security practice)
            return res.status(200).json({ message: "If an account exists with this email, a reset link has been sent." });
        }

        // Generate a random token
        const token = crypto.randomBytes(32).toString('hex');

        // Save token and expiry (1 hour)
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000;
        await user.save();

        // In development, we log the link to the console
        const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${token}`;
        console.log(`\n🔑 [PASSWORD RESET LINK]: ${resetLink}\n`);

        res.status(200).json({
            success: true,
            data: {
                message: "Verification successful. Please set your new clinical password.",
                // In dev environment, we return the token directly for the "Direct Recovery" UI flow
                ...(process.env.NODE_ENV === 'development' && {
                    dev_link_only: resetLink,
                    token: token
                })
            }
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ error: "Password reset token is invalid or has expired." });
        }

        // Validate new password strength (same as register)
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return res.status(400).json({
                error: "Password must be at least 8 characters long, include an uppercase letter, a lowercase letter, a number, and a special character."
            });
        }

        // Hash and save new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.status(200).json({
            success: true,
            data: { message: "Password has been successfully reset." }
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
