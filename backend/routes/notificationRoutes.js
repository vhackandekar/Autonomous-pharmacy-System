const express = require('express');
const router = express.Router();
const notificationController = require('../controller/notificationController');

const { verifyToken, verifyAdmin } = require('../middleware/auth');

router.get('/user/:userId', verifyToken, notificationController.getUserNotifications);
router.get('/admin', verifyToken, verifyAdmin, notificationController.getAdminNotifications);
router.put('/:id/read', verifyToken, notificationController.markAsRead);
router.post('/mark-all-read', verifyToken, notificationController.markAllAsRead);
router.post('/refill', verifyToken, verifyAdmin, notificationController.sendRefillNotification);

module.exports = router;
