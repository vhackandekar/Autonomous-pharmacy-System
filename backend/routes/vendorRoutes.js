const express = require('express');
const router = express.Router();
const vendorController = require('../controller/vendorController');
const { verifyToken, isAdmin } = require('../middleware/auth');

router.get('/', verifyToken, isAdmin, vendorController.getVendors);
router.post('/', verifyToken, isAdmin, vendorController.addVendor);
router.put('/:id', verifyToken, isAdmin, vendorController.updateVendor);
router.delete('/:id', verifyToken, isAdmin, vendorController.deleteVendor);

module.exports = router;
