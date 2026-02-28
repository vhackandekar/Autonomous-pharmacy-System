const Cart = require('../schema/Cart');
const Medicine = require('../schema/Medicine');

exports.getCart = async (req, res) => {
    try {
        const Prescription = require('../schema/Prescription');
        const userId = req.user.id;
        let cart = await Cart.findOne({ userId, status: 'PENDING' }).populate('items.medicineId');

        if (!cart) {
            return res.json({ items: [] });
        }

        // Attach prescription status for each medicine that requires it
        const itemsWithPresc = await Promise.all(cart.items.map(async (item) => {
            const plainItem = item.toObject();
            if (item.medicineId.prescriptionRequired) {
                const presc = await Prescription.findOne({
                    userId,
                    medicineId: item.medicineId._id
                }).sort({ createdAt: -1 });
                plainItem.prescriptionStatus = presc ? presc.status : 'MISSING';
            }
            return plainItem;
        }));

        const response = cart.toObject();
        response.items = itemsWithPresc;
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createCart = async (req, res) => {
    try {
        const userId = req.user.id;
        // Check if pending cart already exists
        let existing = await Cart.findOne({ userId, status: 'PENDING' });
        if (existing) return res.status(200).json(existing);

        const cart = new Cart({ userId, items: [] });
        await cart.save();
        res.status(201).json(cart);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.addToCart = async (req, res) => {
    try {
        const userId = req.user.id;
        const { medicineId, quantity } = req.body;

        if (!medicineId || !quantity) {
            return res.status(400).json({ error: 'medicineId and quantity are required' });
        }

        // Stock check
        const medicine = await Medicine.findById(medicineId);
        if (!medicine) return res.status(404).json({ error: "Medicine not found" });
        if (medicine.stock < quantity) {
            return res.status(400).json({ error: `Insufficient stock. Only ${medicine.stock} available.` });
        }

        let cart = await Cart.findOne({ userId, status: 'PENDING' });
        if (!cart) cart = new Cart({ userId, items: [] });

        const existingItem = cart.items.find(i => i.medicineId.toString() === medicineId);
        if (existingItem) {
            const totalQty = existingItem.quantity + quantity;
            if (medicine.stock < totalQty) {
                return res.status(400).json({ error: `Insufficient stock in total. Only ${medicine.stock} available.` });
            }
            existingItem.quantity = totalQty;
        } else {
            cart.items.push({ medicineId, quantity });
        }

        await cart.save();
        res.json(cart);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.updateCart = async (req, res) => {
    try {
        const userId = req.user.id;
        const { cartId, medicineId, quantity } = req.body;

        // Stock check
        const medicine = await Medicine.findById(medicineId);
        if (!medicine) return res.status(404).json({ error: "Medicine not found" });
        if (medicine.stock < quantity) {
            return res.status(400).json({ error: `Insufficient stock. Only ${medicine.stock} available.` });
        }

        let cart;
        if (cartId) {
            cart = await Cart.findById(cartId);
        } else {
            cart = await Cart.findOne({ userId, status: 'PENDING' });
        }

        if (!cart) return res.status(404).json({ error: "Cart not found" });
        if (cart.userId.toString() !== userId && req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: "Access denied. Not your cart." });
        }

        const item = cart.items.find(i => i.medicineId.toString() === medicineId);
        if (item) item.quantity = quantity;

        await cart.save();
        res.json(cart);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.removeFromCart = async (req, res) => {
    try {
        const { cartId, medicineId } = req.body;
        const userId = req.user.id;

        let cart;
        if (cartId) {
            cart = await Cart.findById(cartId);
        } else {
            cart = await Cart.findOne({ userId, status: 'PENDING' });
        }

        if (!cart) return res.status(404).json({ error: "Cart not found" });
        if (cart.userId.toString() !== userId && req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: "Access denied." });
        }

        cart.items = cart.items.filter(i => i.medicineId.toString() !== medicineId);
        await cart.save();
        res.json(cart);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.clearCart = async (req, res) => {
    try {
        const { cartId } = req.body;
        const userId = req.user.id;
        let cart;
        if (cartId) cart = await Cart.findById(cartId);
        else cart = await Cart.findOne({ userId, status: 'PENDING' });

        if (cart) {
            if (cart.userId.toString() !== userId && req.user.role !== 'ADMIN') {
                return res.status(403).json({ error: "Access denied." });
            }
            cart.items = [];
            await cart.save();
        }
        res.json({ message: "Cart cleared" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
