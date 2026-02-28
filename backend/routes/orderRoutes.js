const express = require('express');
const router = express.Router();
const orderController = require('../controller/orderController');
const { verifyToken } = require('../middleware/auth');

router.post('/place', verifyToken, orderController.placeOrder);
router.get('/history/:userId', verifyToken, orderController.getHistory);
router.get('/:id', verifyToken, orderController.getOrderById);
router.put('/:id/cancel', verifyToken, orderController.cancelOrder);

module.exports = router;
