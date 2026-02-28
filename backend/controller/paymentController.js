const Order = require('../schema/Order');

exports.processPayment = async (req, res) => {
    try {
        const { orderId, paymentMethod, sessionId } = req.body;
        const order = await Order.findById(orderId);

        if (!order) return res.status(404).json({ error: "Order not found" });

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

        // 🚀 CRITICAL: Trigger post-order automation (Notifications, SMS, Webhooks)
        try {
            const OrderPlacementAgent = require('../Agents/OrderPlacementAgent');
            await OrderPlacementAgent.finalizeOrder(order._id, trace, sessionId);
            console.log(`✅ Order ${orderId} finalized and notifications triggered.`);
        } catch (finalizeError) {
            console.error(`⚠️ Payment processed but finalization failed for ${orderId}:`, finalizeError.message);
        }

        res.json({
            success: true,
            message: "Payment successful. Your order has been placed.",
            order,
            transactionId: order.transactionId
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
