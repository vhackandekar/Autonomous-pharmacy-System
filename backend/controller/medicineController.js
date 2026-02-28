const Medicine = require('../schema/Medicine');

exports.getAllMedicines = async (req, res) => {
    try {
        const medicines = await Medicine.find();
        res.json(medicines);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.addMedicine = async (req, res) => {
    try {
        const { name, dosage, stock, price } = req.body;
        if (!name || dosage === undefined || stock === undefined || price === undefined) {
            return res.status(400).json({ error: 'Name, dosage, stock, and price are required' });
        }
        const medicine = new Medicine(req.body);
        await medicine.save();
        res.status(201).json(medicine);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.updateMedicine = async (req, res) => {
    try {
        const updateData = { ...req.body };

        // Reset low stock alert if stock is refilled above 10
        if (updateData.stock !== undefined && updateData.stock >= 10) {
            updateData.lowStockNotified = false;
        }

        const medicine = await Medicine.findByIdAndUpdate(req.params.id, updateData, { new: true });
        res.json(medicine);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
