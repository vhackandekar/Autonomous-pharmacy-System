const express = require('express');
const router = express.Router();
const medicineController = require('../controller/medicineController');
const { verifyToken, verifyAdmin } = require('../middleware/auth');

router.get('/', medicineController.getAllMedicines);
router.post('/add', verifyToken, verifyAdmin, medicineController.addMedicine);
router.put('/update/:id', verifyToken, verifyAdmin, medicineController.updateMedicine);

module.exports = router;
