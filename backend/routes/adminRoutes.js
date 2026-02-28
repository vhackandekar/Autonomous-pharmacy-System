const express = require('express');
const router = express.Router();
const adminController = require('../controller/adminController');
const { verifyToken, isAdmin } = require('../middleware/auth');

router.get('/dashboard', verifyToken, isAdmin, adminController.getStats);
router.get('/orders', verifyToken, isAdmin, adminController.getAllOrders);
router.put('/orders/:id', verifyToken, isAdmin, adminController.updateOrderStatus);
router.get('/analytics', verifyToken, isAdmin, adminController.getAnalytics);
router.get('/activity', verifyToken, isAdmin, adminController.getActivity);
router.get('/inventory', verifyToken, isAdmin, adminController.getInventoryDetails);
router.get('/refill-alerts', verifyToken, isAdmin, adminController.getRefillAlerts);
router.post('/refill-trigger', verifyToken, isAdmin, adminController.triggerRefillAnalysis);

module.exports = router;
