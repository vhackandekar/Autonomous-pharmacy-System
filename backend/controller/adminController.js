const Medicine = require('../schema/Medicine');
const Order = require('../schema/Order');
const RefillAlert = require('../schema/RefillAlert');
const Notification = require('../schema/Notification');
const User = require('../schema/User');

exports.getStats = async (req, res) => {
    try {
        const totalMedicines = await Medicine.countDocuments();
        const lowStock = await Medicine.find({ stock: { $lt: 10 } });
        const pendingRefills = await RefillAlert.countDocuments({ notified: false });
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const ordersToday = await Order.countDocuments({
            createdAt: { $gte: todayStart }
        });

        // Counts by shipment status for dashboard quick-stats
        const inWarehouseCount = await Order.countDocuments({ status: 'IN_WAREHOUSE' });
        const shippedCount = await Order.countDocuments({ status: 'SHIPPED' });

        res.json({
            totalMedicines,
            lowStockCount: lowStock.length,
            pendingRefills,
            ordersToday,
            // Expose counts for frontend: pending orders (in warehouse) and active shipments (shipped)
            inWarehouseCount,
            shippedCount,
            // Backwards-compatible alias
            pendingOrders: inWarehouseCount
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find().populate('userId', 'name email').populate('items.medicineId');
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });

        // Create a notification for the user and emit real-time update
        try {
            const msg = status === 'REJECTED'
                ? `Your order ${order._id} was rejected. Please try again.`
                : `Your order ${order._id} has been ${status.toLowerCase()}.`;

            const userNotif = new Notification({ userId: order.userId, type: 'order', message: msg });
            await userNotif.save();

            if (global.io) {
                // notify the specific user
                global.io.to(String(order.userId)).emit('order_status_updated', { order, message: msg });
                // notify admin room to refresh counts/lists
                global.io.to('admin').emit('order_updated_admin', order);
            }
        } catch (e) { console.error('notify error', e); }

        res.json(order);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getAnalytics = async (req, res) => {
    try {
        // Get all medicines with stock info
        const medicines = await Medicine.find().select('name stock price prescriptionRequired');

        // Get orders stats
        const totalOrders = await Order.countDocuments();
        const confirmedOrders = await Order.countDocuments({ status: 'CONFIRMED' });
        const shippedOrders = await Order.countDocuments({ status: 'SHIPPED' });
        const fulfilledOrders = await Order.countDocuments({ status: 'FULFILLED' });

        // Calculate total revenue
        const ordersWithAmount = await Order.find({ status: 'FULFILLED' }).select('totalAmount');
        const totalRevenue = ordersWithAmount.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

        // Inventory health
        const lowStockCount = await Medicine.countDocuments({ stock: { $lt: 20 } });
        const outOfStockCount = await Medicine.countDocuments({ stock: 0 });

        res.json({
            medicines,
            ordersStats: {
                total: totalOrders,
                confirmed: confirmedOrders,
                shipped: shippedOrders,
                fulfilled: fulfilledOrders
            },
            inventoryHealth: {
                totalItems: medicines.length,
                lowStock: lowStockCount,
                outOfStock: outOfStockCount
            },
            financials: {
                totalRevenue
            },
            timestamp: new Date()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getActivity = async (req, res) => {
    try {
        // Get recent orders (last 20)
        const recentOrders = await Order.find()
            .populate('userId', 'name email phone')
            .sort({ createdAt: -1 })
            .limit(20)
            .select('_id userId totalAmount status createdAt');

        // Get recent users (last 10)
        const recentUsers = await User.find({ role: 'USER' })
            .sort({ createdAt: -1 })
            .limit(10)
            .select('_id name email phone createdAt');

        // Get recent notifications (last 20)
        const recentNotifications = await Notification.find()
            .sort({ createdAt: -1 })
            .limit(20)
            .select('_id userId message type createdAt');

        res.json({
            recentOrders,
            recentUsers,
            recentNotifications,
            timestamp: new Date()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getInventoryDetails = async (req, res) => {
    try {
        // Get all medicines with detailed info
        const allMedicines = await Medicine.find();

        // Categorize medicines
        const lowStock = allMedicines.filter(m => m.stock > 0 && m.stock < 20);
        const outOfStock = allMedicines.filter(m => m.stock === 0);
        const adequateStock = allMedicines.filter(m => m.stock >= 20);

        // Calculate stats
        const totalValue = allMedicines.reduce((sum, m) => sum + (m.price * m.stock), 0);
        const averageStock = Math.round(
            allMedicines.reduce((sum, m) => sum + m.stock, 0) / allMedicines.length
        );

        res.json({
            medicines: allMedicines,
            categories: {
                adequate: adequateStock.length,
                lowStock: lowStock.length,
                outOfStock: outOfStock.length
            },
            analytics: {
                totalItems: allMedicines.length,
                totalValue,
                averageStockLevel: averageStock,
                prescriptionRequired: allMedicines.filter(m => m.prescriptionRequired).length
            },
            timestamp: new Date()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.triggerRefillAnalysis = async (req, res) => {

    const User = require('../schema/User');
    const PredictiveRefillAgent = require('../Agents/PredictiveRefillAgent');

    try {
        console.log('Manually triggering predictive refill analysis...');
        const users = await User.find({ role: 'USER' });
        const results = [];

        for (const user of users) {
            const analysis = await PredictiveRefillAgent.analyzeAndAlert(user._id);
            results.push({
                userId: user._id,
                name: user.name,
                predictionsCount: Array.isArray(analysis) ? analysis.length : 0
            });
        }

        res.json({
            success: true,
            message: 'Manual refill analysis completed.',
            results
        });
    } catch (error) {
        console.error('Manual Refill Analysis Error:', error);
        res.status(500).json({ error: error.message });
    }
};
