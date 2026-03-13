const Order = require('../schema/Order');
const ErrorHandler = require('../utils/ErrorHandler');
const asyncHandler = require('../utils/asyncHandler');

exports.processPayment = asyncHandler(async (req, res, next) => {
    const { orderId, paymentMethod, sessionId } = req.body;
    const order = await Order.findById(orderId);

    if (!order) return next(new ErrorHandler("Order not found", 404));

    const langfuse = require('../utils/langfuseClient');
    const trace = langfuse ? langfuse.trace({
        name: "Payment-Process",
        userId: order.userId.toString(),
        sessionId: sessionId || "untracked-session",
        metadata: { orderId: order._id, paymentMethod }
    }) : null;

    // MOCK PAYMENT LOGIC
    console.log(`Processing ${paymentMethod} for Order ${orderId}...`);

    // Simulating 2 second delay for payment gateway
    await new Promise(resolve => setTimeout(resolve, 2000));

    order.paymentStatus = 'Paid';
    order.status = 'CONFIRMED';
    order.transactionId = "TXN_" + Math.random().toString(36).substr(2, 9).toUpperCase();
    order.paymentMethod = paymentMethod || order.paymentMethod;
    await order.save();

    // 🚀 CRITICAL: Trigger post-order automation
    const OrderPlacementAgent = require('../Agents/OrderPlacementAgent');
    OrderPlacementAgent.finalizeOrder(order._id, trace, sessionId).catch(finalizeError => {
        console.error(`⚠️ Payment processed but finalization failed for ${orderId}:`, finalizeError.message);
    });

    res.json({
        success: true,
        data: {
            message: "Payment successful. Your order has been placed.",
            order,
            transactionId: order.transactionId
        }
    });
});
