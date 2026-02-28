const jwt = require('jsonwebtoken');

exports.verifyToken = (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1];
    console.log('🔐 Token auth check. Received token:', token?.slice(0, 30) + '...');

    if (!token) {
        console.log('❌ No token provided');
        return res.status(401).json({ error: "Access denied. No token provided." });
    }

    try {
        console.log('🔍 Verifying JWT token with secret:', process.env.JWT_SECRET?.slice(0, 10) + '...');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        console.log('✅ JWT verified, user:', decoded.id);
        req.user = decoded;
        next();
    } catch (error) {
        console.error('❌ JWT verification failed:', error.message);
        // Use 401 Unauthorized for invalid/expired tokens so clients
        // can treat this as an authentication failure and react (redirect/login)
        res.status(401).json({ error: "Invalid token." });
    }
};

exports.isAdmin = (req, res, next) => {
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: "Access denied. Admin only." });
    }
    next();
};
