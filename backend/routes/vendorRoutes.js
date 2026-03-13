const express = require('express');
const router = express.Router();
const vendorController = require('../controller/vendorController');
const { verifyToken, verifyAdmin } = require('../middleware/auth');

router.get('/', verifyToken, verifyAdmin, vendorController.getVendors);
router.post('/add', verifyToken, verifyAdmin, vendorController.addVendor);
router.put('/update/:id', verifyToken, verifyAdmin, vendorController.updateVendor);
router.delete('/:id', verifyToken, verifyAdmin, vendorController.deleteVendor);

router.post('/purchase/create', verifyToken, verifyAdmin, vendorController.createPurchaseOrder);
router.get('/purchase', verifyToken, verifyAdmin, vendorController.getPurchaseOrders);
router.put('/purchase/cancel/:id', verifyToken, verifyAdmin, vendorController.cancelPurchaseOrder);
router.put('/purchase/receive/:id', verifyToken, verifyAdmin, vendorController.receivePurchaseOrder);
router.get('/ai-restock-draft', verifyToken, verifyAdmin, vendorController.generateAIDraftPO);

// Vendor Medicines Management
router.post('/:id/medicines', verifyToken, verifyAdmin, vendorController.addMedicineToVendor);
router.get('/:id/medicines', verifyToken, verifyAdmin, vendorController.getVendorMedicines);
router.delete('/:id/medicines/:medicineId', verifyToken, verifyAdmin, vendorController.removeMedicineFromVendor);

router.get('/ping', (req, res) => res.json({ status: 'ok', route: 'vendor' }));
module.exports = router;
