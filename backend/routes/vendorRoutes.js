const express = require('express');
const router = express.Router();
const vendorController = require('../controller/vendorController');
const { verifyToken, isAdmin } = require('../middleware/auth');

router.get('/', verifyToken, isAdmin, vendorController.getVendors);
router.post('/add', verifyToken, isAdmin, vendorController.addVendor);
router.put('/update/:id', verifyToken, isAdmin, vendorController.updateVendor);
router.delete('/:id', verifyToken, isAdmin, vendorController.deleteVendor);

router.post('/purchase/create', verifyToken, isAdmin, vendorController.createPurchaseOrder);
router.get('/purchase', verifyToken, isAdmin, vendorController.getPurchaseOrders);
router.put('/purchase/cancel/:id', verifyToken, isAdmin, vendorController.cancelPurchaseOrder);
router.put('/purchase/receive/:id', verifyToken, isAdmin, vendorController.receivePurchaseOrder);
router.get('/ai-restock-draft', verifyToken, isAdmin, vendorController.generateAIDraftPO);

// Vendor Medicines Management
router.post('/:id/medicines', verifyToken, isAdmin, vendorController.addMedicineToVendor);
router.get('/:id/medicines', verifyToken, isAdmin, vendorController.getVendorMedicines);
router.delete('/:id/medicines/:medicineId', verifyToken, isAdmin, vendorController.removeMedicineFromVendor);

router.get('/ping', (req, res) => res.json({ status: 'ok', route: 'vendor' }));
module.exports = router;
