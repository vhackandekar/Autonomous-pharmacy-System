const Medicine = require('../schema/Medicine');
const StockAlert = require('../schema/StockAlert');
const stockAlertController = require('./stockAlertController');
const Notification = require('../schema/Notification');

exports.getAllMedicines = async (req, res) => {
    try {
        const medicines = await Medicine.find();
        res.json(medicines);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.subscribeToStock = async (req, res) => {
    // Legacy support or redirect to new controller if needed
    return stockAlertController.subscribeToAlert(req, res);
};

exports.addMedicine = async (req, res) => {
    try {
        const { name, dosage, unitType, stock, price, costPrice, prescriptionRequired } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }
        const medicine = new Medicine({
            name,
            dosage,
            unitType,
            stock: Number(stock) || 0,
            price: Number(price) || 0,
            costPrice: Number(costPrice) || 0,
            prescriptionRequired: Boolean(prescriptionRequired)
        });
        await medicine.save();
        res.status(201).json(medicine);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.updateMedicine = async (req, res) => {
    try {
        console.log(`[MED_UPDATE_START] ID: ${req.params.id}`);
        console.log(`[PAYLOAD]:`, JSON.stringify(req.body));

        const medicine = await Medicine.findById(req.params.id);

        if (!medicine) {
            console.error(`[MED_UPDATE_ERROR] Medicine ${req.params.id} not found`);
            return res.status(404).json({ error: 'Medicine not found' });
        }

        const oldStock = medicine.stock;

        // Explicitly set each field
        if (req.body.name !== undefined) medicine.name = req.body.name;
        if (req.body.dosage !== undefined) medicine.dosage = req.body.dosage;
        if (req.body.unitType !== undefined) medicine.unitType = req.body.unitType;
        if (req.body.stock !== undefined) medicine.stock = Number(req.body.stock);
        if (req.body.price !== undefined) medicine.price = Number(req.body.price);
        if (req.body.costPrice !== undefined) {
            console.log(`[COST_DEBUG] Updating costPrice from ${medicine.costPrice} to ${req.body.costPrice}`);
            medicine.costPrice = Number(req.body.costPrice);
        }
        if (req.body.prescriptionRequired !== undefined) {
            medicine.prescriptionRequired = Boolean(req.body.prescriptionRequired);
        }

        // Reset low stock alert if stock is refilled above 10
        if (medicine.stock >= 10) {
            medicine.lowStockNotified = false;
        }

        const updatedMedicine = await medicine.save();

        // Stock Availability Notification (Back-in-Stock Alert)
        if (updatedMedicine.stock > oldStock && updatedMedicine.stock > 0) {
            console.log(`[AVAILABILITY] Stock for ${updatedMedicine.name} has increased to ${updatedMedicine.stock}. Checking for back-in-stock alerts...`);
            await stockAlertController.notifyBackInStock(updatedMedicine._id);
        }

        console.log(`[MED_UPDATE_SUCCESS] New Cost: ${updatedMedicine.costPrice}`);

        res.json(updatedMedicine);
    } catch (error) {
        console.error(`[MED_UPDATE_CRASH]`, error);
        res.status(400).json({ error: error.message });
    }
};

