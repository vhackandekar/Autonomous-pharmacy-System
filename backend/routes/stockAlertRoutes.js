const express = require('express');
const router = express.Router();
const stockAlertController = require('../controller/stockAlertController');
const { verifyToken } = require('../middleware/auth');

router.post('/subscribe', verifyToken, stockAlertController.subscribeToAlert);

module.exports = router;
