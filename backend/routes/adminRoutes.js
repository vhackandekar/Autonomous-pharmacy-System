const express = require('express');
const router = express.Router();
const adminController = require('../controller/adminController');
const aiAdminController = require('../controller/aiAdminController');
const { verifyToken, verifyAdmin } = require('../middleware/auth');

router.get('/dashboard', verifyToken, verifyAdmin, adminController.getStats);
router.get('/orders', verifyToken, verifyAdmin, adminController.getAllOrders);
router.put('/orders/:id', verifyToken, verifyAdmin, adminController.updateOrderStatus);
router.get('/analytics', verifyToken, verifyAdmin, adminController.getAnalytics);
router.get('/activity', verifyToken, verifyAdmin, adminController.getActivity);
router.get('/inventory', verifyToken, verifyAdmin, adminController.getInventoryDetails);
router.get('/refill-alerts', verifyToken, verifyAdmin, adminController.getRefillAlerts);
router.post('/refill-trigger', verifyToken, verifyAdmin, adminController.triggerRefillAnalysis);
router.post('/ai-chat', verifyToken, verifyAdmin, aiAdminController.processAIChat);

module.exports = router;
