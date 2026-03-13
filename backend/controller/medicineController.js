const Medicine = require('../schema/Medicine');
const StockAlert = require('../schema/StockAlert');
const stockAlertController = require('./stockAlertController');
const Notification = require('../schema/Notification');
const { checkLowStockAndNotify } = require('../utils/inventoryUtility');
const ErrorHandler = require('../utils/ErrorHandler');
const asyncHandler = require('../utils/asyncHandler');

exports.getAllMedicines = asyncHandler(async (req, res, next) => {
    const medicines = await Medicine.find();
    res.json({
        success: true,
        data: { medicines }
    });
});

exports.addMedicine = asyncHandler(async (req, res, next) => {
    const { name, dosage, unitType, stock, price, costPrice, prescriptionRequired, reorderLevel } = req.body;

    // 1. Structural Validation
    if (!name || name.trim() === '') {
        return next(new ErrorHandler('Medicine name is required', 400));
    }
    if (!dosage) {
        return next(new ErrorHandler('Dosage is required (e.g., 500mg)', 400));
    }

    // 2. Duplicate Check (Name + Dosage is usually unique)
    const existing = await Medicine.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        dosage: { $regex: new RegExp(`^${dosage.trim()}$`, 'i') }
    });
    if (existing) {
        return next(new ErrorHandler('A medicine with this name and dosage already exists in inventory', 400));
    }

    // 3. Numerical Validation
    const nStock = Number(stock);
    const nPrice = Number(price);
    const nCostPrice = Number(costPrice);
    const nReorder = Number(reorderLevel) || 20;

    if (isNaN(nStock) || nStock < 0) return next(new ErrorHandler('Stock must be a non-negative number', 400));
    if (isNaN(nPrice) || nPrice <= 0) return next(new ErrorHandler('Selling Price must be greater than zero', 400));
    if (isNaN(nCostPrice) || nCostPrice < 0) return next(new ErrorHandler('Cost Price must be a non-negative number', 400));
    if (nPrice <= nCostPrice) {
        return next(new ErrorHandler('Selling price should ideally be greater than cost price', 400));
    }

    const medicine = new Medicine({
        name: name.trim(),
        dosage: dosage.trim(),
        unitType: unitType || 'tablets',
        stock: nStock,
        price: nPrice,
        costPrice: nCostPrice,
        reorderLevel: nReorder,
        prescriptionRequired: Boolean(prescriptionRequired)
    });
    await medicine.save();
    res.status(201).json({
        success: true,
        data: {
            message: "Medicine added successfully",
            medicine
        }
    });
});

exports.updateMedicine = asyncHandler(async (req, res, next) => {
    const medicine = await Medicine.findById(req.params.id);

    if (!medicine) {
        return next(new ErrorHandler('Medicine not found', 404));
    }

    const oldStock = medicine.stock;

    // Explicitly set each field with validation
    if (req.body.name !== undefined) {
        if (req.body.name.trim() === '') return next(new ErrorHandler('Name cannot be empty', 400));
        medicine.name = req.body.name.trim();
    }
    if (req.body.dosage !== undefined) medicine.dosage = req.body.dosage;
    if (req.body.unitType !== undefined) medicine.unitType = req.body.unitType;

    if (req.body.stock !== undefined) {
        const val = Number(req.body.stock);
        if (isNaN(val) || val < 0) return next(new ErrorHandler('Stock must be non-negative', 400));
        medicine.stock = val;
    }

    if (req.body.price !== undefined) {
        const val = Number(req.body.price);
        if (isNaN(val) || val < 0) return next(new ErrorHandler('Selling Price must be non-negative', 400));
        medicine.price = val;
    }

    if (req.body.costPrice !== undefined) {
        const val = Number(req.body.costPrice);
        if (isNaN(val) || val < 0) return next(new ErrorHandler('Cost Price must be non-negative', 400));
        medicine.costPrice = val;
    }

    if (req.body.prescriptionRequired !== undefined) {
        medicine.prescriptionRequired = Boolean(req.body.prescriptionRequired);
    }

    const updatedMedicine = await medicine.save();

    // Check for low stock and notify admin if it was reduced manually
    await checkLowStockAndNotify(updatedMedicine, global.io);

    // Stock Availability Notification (Back-in-Stock Alert)
    if (updatedMedicine.stock > oldStock && updatedMedicine.stock > 0) {
        await stockAlertController.notifyBackInStock(updatedMedicine._id);
    }

    res.json({
        success: true,
        data: {
            message: "Medicine updated successfully",
            medicine: updatedMedicine
        }
    });
});

