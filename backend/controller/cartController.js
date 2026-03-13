const Cart = require('../schema/Cart');
const Medicine = require('../schema/Medicine');
const ErrorHandler = require('../utils/ErrorHandler');
const asyncHandler = require('../utils/asyncHandler');

exports.getCart = asyncHandler(async (req, res, next) => {
    const Prescription = require('../schema/Prescription');
    const userId = req.user.id;
    let cart = await Cart.findOne({ userId, status: 'PENDING' }).populate('items.medicineId');

    if (!cart) {
        return res.json({ success: true, data: { items: [] } });
    }

    // Attach prescription status for each medicine that requires it
    const itemsWithPresc = await Promise.all(cart.items.map(async (item) => {
        const plainItem = item.toObject();
        if (item.medicineId && item.medicineId.prescriptionRequired) {
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
    res.json({
        success: true,
        data: { cart: response }
    });
});

exports.createCart = asyncHandler(async (req, res, next) => {
    const userId = req.user.id;
    // Check if pending cart already exists
    let existing = await Cart.findOne({ userId, status: 'PENDING' });
    if (existing) return res.status(200).json({ success: true, data: { cart: existing } });

    const cart = new Cart({ userId, items: [] });
    await cart.save();
    res.status(201).json({
        success: true,
        data: { cart }
    });
});

exports.addToCart = asyncHandler(async (req, res, next) => {
    const userId = req.user.id;
    const { medicineId, quantity } = req.body;

    if (!medicineId || quantity === undefined) {
        return next(new ErrorHandler('medicineId and quantity are required', 400));
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
        return next(new ErrorHandler('Quantity must be a positive integer', 400));
    }

    // Stock check
    const medicine = await Medicine.findById(medicineId);
    if (!medicine) return next(new ErrorHandler("Medicine not found", 404));
    if (medicine.stock < quantity) {
        return next(new ErrorHandler(`Insufficient stock. Only ${medicine.stock} available.`, 400));
    }

    let cart = await Cart.findOne({ userId, status: 'PENDING' });
    if (!cart) cart = new Cart({ userId, items: [] });

    const existingItem = cart.items.find(i => i.medicineId.toString() === medicineId);
    if (existingItem) {
        const totalQty = existingItem.quantity + quantity;
        if (medicine.stock < totalQty) {
            return next(new ErrorHandler(`Insufficient stock in total. Only ${medicine.stock} available.`, 400));
        }
        existingItem.quantity = totalQty;
    } else {
        cart.items.push({ medicineId, quantity });
    }

    await cart.save();
    res.json({
        success: true,
        data: {
            message: "Item added to cart",
            cart
        }
    });
});

exports.updateCart = asyncHandler(async (req, res, next) => {
    const userId = req.user.id;
    const { cartId, medicineId, quantity } = req.body;

    if (quantity === undefined || !Number.isInteger(quantity) || quantity < 1) {
        return next(new ErrorHandler('Quantity must be a positive integer', 400));
    }

    // Stock check
    const medicine = await Medicine.findById(medicineId);
    if (!medicine) return next(new ErrorHandler("Medicine not found", 404));
    if (medicine.stock < quantity) {
        return next(new ErrorHandler(`Insufficient stock. Only ${medicine.stock} available.`, 400));
    }

    let cart;
    if (cartId) {
        cart = await Cart.findById(cartId);
    } else {
        cart = await Cart.findOne({ userId, status: 'PENDING' });
    }

    if (!cart) return next(new ErrorHandler("Cart not found", 404));
    if (cart.userId.toString() !== userId && req.user.role !== 'ADMIN') {
        return next(new ErrorHandler("Access denied. Not your cart.", 403));
    }

    const item = cart.items.find(i => i.medicineId.toString() === medicineId);
    if (item) item.quantity = quantity;

    await cart.save();
    res.json({
        success: true,
        data: {
            message: "Cart updated",
            cart
        }
    });
});

exports.removeFromCart = asyncHandler(async (req, res, next) => {
    const { cartId, medicineId } = req.body;
    const userId = req.user.id;

    let cart;
    if (cartId) {
        cart = await Cart.findById(cartId);
    } else {
        cart = await Cart.findOne({ userId, status: 'PENDING' });
    }

    if (!cart) return next(new ErrorHandler("Cart not found", 404));
    if (cart.userId.toString() !== userId && req.user.role !== 'ADMIN') {
        return next(new ErrorHandler("Access denied.", 403));
    }

    cart.items = cart.items.filter(i => i.medicineId.toString() !== medicineId);
    await cart.save();
    res.json({
        success: true,
        data: {
            message: "Item removed from cart",
            cart
        }
    });
});

exports.clearCart = asyncHandler(async (req, res, next) => {
    const { cartId } = req.body;
    const userId = req.user.id;
    let cart;
    if (cartId) cart = await Cart.findById(cartId);
    else cart = await Cart.findOne({ userId, status: 'PENDING' });

    if (cart) {
        if (cart.userId.toString() !== userId && req.user.role !== 'ADMIN') {
            return next(new ErrorHandler("Access denied.", 403));
        }
        cart.items = [];
        await cart.save();
    }
    res.json({
        success: true,
        data: { message: "Cart cleared" }
    });
});
