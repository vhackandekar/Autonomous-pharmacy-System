const Medicine = require('../schema/Medicine');
const Order = require('../schema/Order');
const RefillAlert = require('../schema/RefillAlert');
const Notification = require('../schema/Notification');
const User = require('../schema/User');
const stockAlertController = require('./stockAlertController');

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
        const pendingCount = await Order.countDocuments({ status: 'PENDING' });
        const confirmedCount = await Order.countDocuments({ status: 'CONFIRMED' });
        const outForDeliveryCount = await Order.countDocuments({ status: 'OUT_FOR_DELIVERY' });

        // Calculate total revenue from delivered orders
        const deliveredOrders = await Order.find({ status: 'DELIVERED' }).select('totalAmount');
        const totalRevenue = deliveredOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

        res.json({
            totalMedicines,
            lowStockCount: lowStock.length,
            pendingRefills,
            ordersToday,
            totalRevenue,
            // Expose counts for frontend
            confirmedCount,
            outForDeliveryCount,
            // Main counts for frontend dashboard cards
            pendingOrders: pendingCount,
            inWarehouseCount: confirmedCount,
            deliveredCount: deliveredOrders.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find().populate('userId', 'name email phone address1 address2 city state pin').populate('items.medicineId');
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const InventoryLog = require('../schema/InventoryLog');
const axios = require('axios');
const PredictiveRefillAgent = require('../Agents/PredictiveRefillAgent');

exports.updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['PENDING', 'CONFIRMED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const order = await Order.findById(req.params.id).populate('items.medicineId').populate('userId', 'name email phone address1 address2 city state pin');
        if (!order) return res.status(404).json({ error: 'Order not found' });

        const previousStatus = order.status;
        console.log(`Updating order ${order._id} from ${previousStatus} to ${status}`);

        // 1. Restore stock if moving BACK from DELIVERED
        // 1. Restore stock if moving BACK from DELIVERED or moving to CANCELLED
        if ((previousStatus === 'DELIVERED' && status !== 'DELIVERED') || status === 'CANCELLED') {
            // But only restore if the order wasn't already CANCELLED (to avoid double restoration)
            if (previousStatus !== 'CANCELLED') {
                for (const item of order.items) {
                    const oldMed = await Medicine.findById(item.medicineId);
                    const oldStock = oldMed ? oldMed.stock : -1;

                    const med = await Medicine.findByIdAndUpdate(item.medicineId, {
                        $inc: { stock: item.quantity },
                        lowStockNotified: false
                    }, { new: true });

                    if (med) {
                        await new InventoryLog({
                            medicineId: med._id,
                            change: item.quantity,
                            reason: `ORDER_STATUS_CHANGED_TO_${status}`
                        }).save();

                        // Trigger Back-in-Stock Notifications if stock was 0 but is now > 0
                        if (oldStock === 0 && med.stock > 0) {
                            console.log(`[AVAILABILITY_REVERT] Stock for ${med.name} restored via Admin Update. Notifying users...`);
                            await stockAlertController.notifyBackInStock(med._id);
                        }
                    }
                }
            }
        }

        // 2. Deduct stock ONLY when moving to DELIVERED status from anything else
        // 2. We no longer deduct stock on DELIVERED as it is reserved at order creation.
        // We only perform the low-stock notification check here for finality.
        if (status === 'DELIVERED' && previousStatus !== 'DELIVERED') {
            for (const item of order.items) {
                const med = await Medicine.findById(item.medicineId);
                if (med && med.stock < (med.reorderLevel || 10) && !med.lowStockNotified) {
                    const adminNotif = new Notification({
                        recipientRole: 'ADMIN',
                        type: 'stock_alert',
                        message: `⚠️ Inventory Alert: ${med.name} is running critically low (${med.stock} units left).`
                    });
                    await adminNotif.save();
                    if (global.io) global.io.to('admin').emit('stock_alert', adminNotif);

                    med.lowStockNotified = true;
                    await med.save();
                }
            }
        }

        order.status = status;
        await order.save();

        // Create notifications and emit updates
        try {
            let msg = (status === 'CANCELLED')
                ? `Your order ${order._id} was ${status.toLowerCase()}.`
                : `Your order ${order._id} has been updated to ${status.toLowerCase()}.`;

            if (status === 'DELIVERED' && order.estimatedEndDate) {
                msg = `✅ Your order has been delivered! Based on your dosage, we predict you will run out of medication around ${new Date(order.estimatedEndDate).toLocaleDateString()}. We'll notify you 2 days before then!`;
            }

            const userNotif = new Notification({ userId: order.userId, type: 'order', message: msg, orderId: order._id });
            await userNotif.save();

            if (global.io) {
                global.io.to(String(order.userId)).emit('order_status_updated', { order, message: msg });
                global.io.to('admin').emit('order_updated_admin', order);
            }

            // Trigger Predictive Refill Analysis immediately upon delivery
            if (status === 'DELIVERED') {
                PredictiveRefillAgent.analyzeAndAlert(order.userId).catch(err => console.error('delivery refill analyze error', err));
            }
        } catch (e) {
            console.error('Notification/Socket Error:', e);
        }

        res.json(order);
    } catch (error) {
        console.error('Update Order Status Error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getAnalytics = async (req, res) => {
    try {
        // Get all medicines with stock info
        const medicines = await Medicine.find().select('name stock price prescriptionRequired');

        // Get orders stats
        const totalOrders = await Order.countDocuments();
        const pendingOrders = await Order.countDocuments({ status: 'PENDING' });
        const confirmedOrders = await Order.countDocuments({ status: 'CONFIRMED' });
        const outForDeliveryOrders = await Order.countDocuments({ status: 'OUT_FOR_DELIVERY' });
        const deliveredOrders = await Order.countDocuments({ status: 'DELIVERED' });

        // Calculate total revenue
        const ordersWithAmount = await Order.find({ status: 'DELIVERED' }).select('totalAmount');
        const totalRevenue = ordersWithAmount.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

        // Inventory health
        const lowStockCount = await Medicine.countDocuments({ stock: { $lt: 20 } });
        const outOfStockCount = await Medicine.countDocuments({ stock: 0 });

        res.json({
            medicines,
            ordersStats: {
                total: totalOrders,
                pending: pendingOrders,
                confirmed: confirmedOrders,
                outForDelivery: outForDeliveryOrders,
                delivered: deliveredOrders
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

exports.getRefillAlerts = async (req, res) => {
    try {
        const alerts = await RefillAlert.find()
            .populate('userId', 'name email phone')
            .populate('medicineId', 'name stock price')
            .sort({ daysLeft: 1 });
        res.json(alerts);
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
