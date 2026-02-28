const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const cron = require('node-cron');
const { initCronJobs } = require('./utils/cronJobs');
const PredictiveRefillAgent = require('./Agents/PredictiveRefillAgent');
const User = require('./schema/User');

// Load env vars immediately
dotenv.config();

const app = express();
const http = require('http');
const { Server } = require('socket.io');
const authRoutes = require('./routes/authRoutes');
const agentRoutes = require('./routes/agentRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const medicineRoutes = require('./routes/medicineRoutes');
const prescriptionRoutes = require('./routes/prescriptionRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const adminRoutes = require('./routes/adminRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

//midlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});
app.use('/uploads', express.static('uploads'));
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'], // Allowed origins
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
    credentials: true // Allow cookies/auth headers
}));

app.use('/api/auth', authRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/order', orderRoutes);
app.use('/api/medicine', medicineRoutes);
app.use('/api/prescription', prescriptionRoutes);
app.use('/api/notify', notificationRoutes);
app.use('/webhook/n8n', webhookRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payment', paymentRoutes);

const port = process.env.PORT || 5000;
//database connection – normalize URL (trim + strip quotes so .env parsing is robust)
const rawUrl = process.env.MONGODB_URL || '';
const MONGODB_URL = rawUrl.trim().replace(/^["']|["']$/g, '');
if (!MONGODB_URL.startsWith('mongodb://') && !MONGODB_URL.startsWith('mongodb+srv://')) {
    console.error('Invalid MONGODB_URL: must start with mongodb:// or mongodb+srv://');
}

const main = async () => {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(MONGODB_URL, {
            serverSelectionTimeoutMS: 20000, // Increase timeout to 20s
            family: 4 // Use IPv4
        });
        console.log("Connected successfully to the database");

        // Create HTTP server and attach Socket.IO for real-time notifications
        const server = http.createServer(app);
        const io = new Server(server, {
            cors: {
                origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
                methods: ['GET', 'POST']
            }
        });

        // Expose io on global so controllers can emit events without circular imports
        global.io = io;

        io.on('connection', (socket) => {
            console.log('socket connected:', socket.id);
            // client should send an initial `join` event with { role, userId }
            socket.on('join', ({ role, userId } = {}) => {
                try {
                    if (role === 'ADMIN') {
                        socket.join('admin');
                        console.log(`socket ${socket.id} joined admin room`);
                    }
                    if (userId) {
                        socket.join(String(userId));
                        console.log(`socket ${socket.id} joined user room ${userId}`);
                    }
                } catch (e) { console.error(e); }
            });
            socket.on('disconnect', () => { console.log('socket disconnected:', socket.id); });
        });

        // Initialize Automated Background Tasks
        initCronJobs();

        server.listen(port, () => {
            console.log("Server running on port", port);
        });
    } catch (err) {
        console.error("Critical: Database connection failed!");
        console.error(err);
        process.exit(1); // Exit if DB connection fails on startup
    }
};

main();
