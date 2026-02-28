const express = require('express');
const router = express.Router();
const medicineController = require('../controller/medicineController');
const { verifyToken, isAdmin } = require('../middleware/auth');

router.get('/', medicineController.getAllMedicines);
router.post('/add', verifyToken, isAdmin, medicineController.addMedicine);
router.put('/update/:id', verifyToken, isAdmin, medicineController.updateMedicine);

module.exports = router;
