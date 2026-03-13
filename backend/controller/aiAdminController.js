const Order = require('../schema/Order');
const Medicine = require('../schema/Medicine');
const User = require('../schema/User');
const Vendor = require('../schema/Vendor');
const PurchaseOrder = require('../schema/PurchaseOrder');
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Helper to format currency
const formatCurrency = (val) => `₹${Number(val).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.processAIChat = async (req, res) => {
    try {
        const { message } = req.body;
        const query = message.toLowerCase();

        // 1. Check for hardcoded structured triggers first for speed and reliability
        if (query.includes('monthly report')) return res.json(await generateMonthlyReport());
        if (query.includes('yearly report')) return res.json(await generateYearlyReport());
        if (query.includes('recent orders')) return res.json(await getRecentOrders());
        if (query.includes('profit analysis')) return res.json(await generateProfitAnalysis());
        if (query.includes('low stock')) return res.json(await getLowStock());
        if (query.includes('top selling medicines') || query.includes('top selling medicine')) return res.json(await getTopSellingMedicines(true));
        if (query.includes('monthly revenue trend') || query.includes('revenue trend')) return res.json(await getMonthlyRevenueTrend());
        if (query.includes('order status distribution') || query.includes('order status')) return res.json(await getOrderStatusDistribution());
        if (query.includes('yearly growth')) return res.json(await getYearlyGrowth());
        if (query.includes('profit comparison')) return res.json(await getProfitComparison());
        if (query.includes('order low stock medicines') || query.includes('restock')) return res.json(await handleAIRestockDraft());

        if (query.includes('audit todays performance') || query.includes('audit today')) {
            const rep = await generateMonthlyReport();
            rep.content = "## Today's Performance Audit\n" + rep.content;
            return res.json(rep);
        }

        // 2. Intelligence: Handle natural language updates (innovation!)
        if (query.includes('update') && (query.includes('cost') || query.includes('price'))) {
            return res.json(await handleAIUpdate(message));
        }



        // 2. If not a direct trigger, use Gemini for intelligent response
        const systemContext = await getSystemContext();
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
            You are "AI Chat", the Pharmacy Admin Intelligence system for an Autonomous Pharmacy.
            You have access to the following real-time system data:
            ${JSON.stringify(systemContext, null, 2)}

            Guidelines:
            - Use Markdown for formatting (headers, bullets).
            - Always think like a business consultant/admin assistant.
            - If the user asks for things you can't do, explain your capabilities.
            - Your current capabilities include: Monthly/Yearly reports, Profit analysis (MTD/YTD), Low stock alerts, Revenue trends, and Top selling medicines.
            - UNIQUE FEATURE: You can now update cost prices! Example: "Update the cost price of paracetamol to 45" or "Change Dolo cost to 12".
            - Keep responses professional and data-driven.

            User Message: "${message}"
            
            Response:
        `;

        const result = await model.generateContent(prompt);
        let aiResponse = result.response.text();

        // Extra check: if the AI *thinks* it updated something but didn't trigger handleAIUpdate
        if (aiResponse.toLowerCase().includes('successfully updated') && !query.includes('update')) {
            // Just safety check
        }

        res.json({
            role: 'agent',
            content: aiResponse,
            type: 'text',
            data: null,
            time: new Date()
        });

    } catch (error) {
        console.error('AI Chat Error:', error);
        res.status(500).json({ error: 'Failed to process AI request' });
    }
};

async function getSystemContext() {
    try {
        const [totalMedicines, lowStock, totalOrders, recentSales, allMedNames] = await Promise.all([
            Medicine.countDocuments(),
            Medicine.countDocuments({ $expr: { $lt: ["$stock", "$reorderLevel"] } }),
            Order.countDocuments(),
            Order.find().sort({ orderDate: -1 }).limit(5).select('totalAmount status orderDate'),
            Medicine.find().select('name costPrice price stock')
        ]);

        // Get total revenue for context
        const revenueData = await Order.aggregate([
            { $group: { _id: null, total: { $sum: "$totalAmount" } } }
        ]);

        return {
            inventorySummary: {
                totalUniqueMedicines: totalMedicines,
                itemsBelowReorderLevel: lowStock,
                medicinesInSystem: allMedNames.map(m => ({ name: m.name, cost: m.costPrice, sell: m.price, stock: m.stock }))
            },
            salesSummary: {
                totalOrdersProcessed: totalOrders,
                totalLifetimeRevenue: revenueData[0]?.total || 0,
                recentTransactions: recentSales.map(s => ({
                    amount: s.totalAmount,
                    status: s.status,
                    date: s.orderDate
                }))
            },
            currentDate: new Date().toLocaleDateString(),
            pharmacyName: "Autonomous Pharmacy System"
        };
    } catch (e) {
        return { error: "Could not fetch full context" };
    }
}

async function handleAIUpdate(message) {
    try {
        const medicines = await Medicine.find().select('name');
        const medNames = medicines.map(m => m.name).join(', ');

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `
            Analyze this user request: "${message}"
            Extract the Medicine Name and the New Cost Price.
            Available Medicines: [${medNames}]
            
            Return ONLY a valid JSON object like this:
            {"found": true, "medicineName": "Exact Name From List", "newCost": 123}
            If not found or not a price update request, return:
            {"found": false}
        `;

        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json|```/g, '').trim();
        const data = JSON.parse(text);

        if (data.found && data.medicineName && data.newCost) {
            const med = await Medicine.findOne({ name: data.medicineName });
            if (med) {
                const oldCost = med.costPrice;
                med.costPrice = Number(data.newCost);
                await med.save();

                return {
                    role: 'agent',
                    content: `### ✅ Price Update Successful\n\nI have updated the cost price for **${med.name}**.\n\n• **Old Cost:** ₹${oldCost}\n• **New Cost:** ₹${med.costPrice}\n• **Status:** Database synchronized.\n\nThis change will immediately reflect in your profit analytics and margin reports.`,
                    type: 'alert',
                    time: new Date()
                };
            }
        }

        return {
            role: 'agent',
            content: "I understood you wanted to update a price, but I couldn't identify the exact medicine or the price value. Please try saying: 'Update cost price of [Medicine Name] to [Amount]'.",
            type: 'text',
            time: new Date()
        };
    } catch (e) {
        console.error('AI Update Error:', e);
        return { role: 'agent', content: "Sorry, I had trouble processing that update request.", type: 'text' };
    }
}

async function handleAIRestockDraft() {
    try {
        const lowStockMedicines = await Medicine.find({
            $expr: { $lt: ["$stock", "$reorderLevel"] }
        });

        if (lowStockMedicines.length === 0) {
            return {
                role: 'agent',
                content: "### ✅ Inventory Status: Healthy\n\nI've analyzed your current stock levels against reorder points. All items are currently above their minimum thresholds. No automated restocking is needed at this moment.",
                type: 'text',
                time: new Date()
            };
        }

        const vendor = await Vendor.findOne({ status: 'Active' });

        const items = lowStockMedicines.map(m => {
            const refillQty = (m.reorderLevel * 2) - m.stock;
            return {
                name: m.name,
                stock: m.stock,
                reorder: m.reorderLevel,
                suggested: refillQty > 0 ? refillQty : m.reorderLevel,
                cost: m.costPrice || 0
            };
        });

        const totalCost = items.reduce((sum, i) => sum + (i.suggested * i.cost), 0);

        let content = `### 🤖 AI Restock Intelligence\n\nI have identified **${items.length} items** that require urgent restocking. I've drafted a Purchase Order for your primary vendor: **${vendor?.name || 'Unknown Vendor'}**.\n\n| Medicine | Current | Reorder | **Order Qty** | Cost |\n| :--- | :--- | :--- | :--- | :--- |\n`;

        items.forEach(i => {
            content += `| ${i.name} | ${i.stock} | ${i.reorder} | **+${i.suggested}** | ₹${i.cost} |\n`;
        });

        content += `\n**Estimated Total Order Value: ₹${totalCost.toLocaleString()}**\n\nWould you like me to finalize this draft and send it to the vendor?`;

        return {
            role: 'agent',
            content,
            type: 'restock',
            time: new Date()
        };

    } catch (e) {
        console.error('AI Restock Error:', e);
        return { role: 'agent', content: "I encountered an error while trying to analyze your inventory for restocking.", type: 'text' };
    }
}

// EXISTING FUNCTIONS (UNCHANGED logic, but included for complete file rewrite)

async function generateMonthlyReport() {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const orders = await Order.find({
        orderDate: { $gte: startOfMonth },
        status: { $nin: [/rejected/i, /cancelled/i] }
    }).populate('items.medicineId');

    const totalOrders = orders.length;
    const totalAllTimeOrders = await Order.countDocuments();
    const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

    let totalCOGS = 0;
    let missingCostData = false;
    orders.forEach(o => {
        o.items.forEach(item => {
            const med = item.medicineId;
            if (med && med.costPrice) {
                totalCOGS += (Number(med.costPrice) * item.quantity);
            } else {
                missingCostData = true;
            }
        });
    });

    const netProfit = totalRevenue - totalCOGS;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const pendingOrders = await Order.countDocuments({ status: 'PENDING', orderDate: { $gte: startOfMonth } });
    const lowStockAlerts = await Medicine.countDocuments({
        $expr: { $lt: ["$stock", "$reorderLevel"] }
    });

    const medicineSales = {};
    orders.forEach(o => {
        o.items.forEach(item => {
            if (item.medicineId) {
                const id = item.medicineId.name;
                medicineSales[id] = (medicineSales[id] || 0) + item.quantity;
            }
        });
    });
    const topMedicine = Object.entries(medicineSales).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    let content = `## Monthly Performance Report (${new Date().toLocaleString('default', { month: 'long' })})\n\n`;
    content += `• Total Orders: ${totalOrders}\n`;
    content += `• Total Revenue: ${formatCurrency(totalRevenue)}\n`;
    content += `• Total Cost: ${totalCOGS > 0 ? formatCurrency(totalCOGS) : '₹0 (Cost data missing)'} ${missingCostData && totalCOGS > 0 ? '(Partial)' : ''}\n`;
    content += `• Net Profit: ${formatCurrency(netProfit)}\n`;
    content += `• Profit Margin %: ${totalRevenue > 0 ? profitMargin.toFixed(2) + '%' : '0.00%'}\n`;
    content += `• Top Selling Medicine: ${topMedicine}\n`;
    content += `• Pending Orders: ${pendingOrders}\n`;
    content += `• Total Records Checked: ${totalOrders}/${totalAllTimeOrders}\n\n`;

    content += `### Business Recommendation\n`;
    if (lowStockAlerts > 0) {
        content += `1. Urgent Restock: ${lowStockAlerts} items are below safety levels. Recommend immediate procurement to maintain fulfilling ${totalOrders} scale demand.\n`;
    }
    content += `2. Margin Analysis: The current margin of ${profitMargin.toFixed(2)}% is stable. ${missingCostData ? 'However, 100% accurate profit tracking requires updating cost prices for all inventory items.' : ''}`;

    return { role: 'agent', content, type: 'report' };
}

async function generateYearlyReport() {
    const startOfYear = new Date();
    startOfYear.setMonth(0, 1);
    startOfYear.setHours(0, 0, 0, 0);

    const orders = await Order.find({
        orderDate: { $gte: startOfYear },
        status: { $nin: [/rejected/i, /cancelled/i] }
    }).populate('items.medicineId');

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

    let totalCOGS = 0;
    let missingCostData = false;
    orders.forEach(o => {
        o.items.forEach(item => {
            if (item.medicineId?.costPrice) {
                totalCOGS += (item.medicineId.costPrice * item.quantity);
            } else {
                missingCostData = true;
            }
        });
    });

    const netProfit = totalRevenue - totalCOGS;

    const monthlyData = {};
    orders.forEach(o => {
        const month = o.orderDate.getMonth();
        monthlyData[month] = (monthlyData[month] || 0) + o.totalAmount;
    });

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const sortedMonths = Object.entries(monthlyData).sort((a, b) => b[1] - a[1]);
    const bestMonthNum = sortedMonths[0]?.[0];
    const worstMonthNum = sortedMonths[sortedMonths.length - 1]?.[0];

    const bestMonth = bestMonthNum !== undefined ? monthNames[bestMonthNum] : 'N/A';
    const worstMonth = worstMonthNum !== undefined ? monthNames[worstMonthNum] : 'N/A';

    let content = `## Yearly Business Analysis (${new Date().getFullYear()})\n\n`;
    content += `• Total Annual Revenue: ${formatCurrency(totalRevenue)}\n`;
    content += `• Total Annual Profit: ${formatCurrency(netProfit)} ${missingCostData ? '(Estimate - cost data missing for some items)' : ''}\n`;
    content += `• Best Performing Month: ${bestMonth}\n`;
    content += `• Worst Performing Month: ${worstMonth}\n`;
    content += `• Total Orders: ${totalOrders}\n`;
    content += `• Revenue Growth %: (Requires comparison data from previous year)\n\n`;

    content += `### Business Insight\n`;
    content += `The pharmacy generated ${formatCurrency(totalRevenue)} this year. Peak performance in ${bestMonth} suggests high seasonal demand. Strategy: Analyze the product mix of ${bestMonth} to replicate this success in ${worstMonth} through targeted promotions.`;

    return { role: 'agent', content, type: 'report' };
}

async function getRecentOrders() {
    const orders = await Order.find()
        .populate('userId', 'name')
        .sort({ orderDate: -1 })
        .limit(5);

    let content = `## Recent Orders\n\n`;
    orders.forEach(o => {
        const date = new Date(o.orderDate).toLocaleDateString('en-IN');
        const displayStatus = o.status;
        content += `• Order ID: ${o._id.toString().slice(-6).toUpperCase()} | Customer: ${o.userId?.name || 'Guest'} | Amount: ${formatCurrency(o.totalAmount)} | Status: ${displayStatus} | Payment: ${o.paymentStatus} | Date: ${date}\n`;
    });

    if (orders.length === 0) content += "No recent orders found.\n";

    content += `\n### Business Insight\n`;
    const pending = orders.filter(o => o.status === 'PENDING').length;
    content += pending > 0 ? `Action Needed: There are ${pending} unconfirmed orders in the latest batch. Immediate verification is recommended to maintain shipping SLAs.` : `Order flow is consistent and latest orders are being processed without delays.`;

    return { role: 'agent', content, type: 'list' };
}

async function generateProfitAnalysis() {
    const orders = await Order.find({
        status: { $nin: [/rejected/i, /cancelled/i] }
    }).populate('items.medicineId');

    const totalAllTimeOrders = await Order.countDocuments();
    const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

    let totalCOGS = 0;
    let missingCostData = false;
    orders.forEach(o => {
        o.items.forEach(item => {
            const med = item.medicineId;
            if (med && med.costPrice) {
                totalCOGS += (Number(med.costPrice) * item.quantity);
            } else {
                missingCostData = true;
            }
        });
    });

    const netProfit = totalRevenue - totalCOGS;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    let content = `## Profit Analysis Report\n\n`;
    content += `• Total Revenue: ${formatCurrency(totalRevenue)}\n`;
    content += `• Total Cost: ${formatCurrency(totalCOGS)} ${missingCostData ? '(Note: Missing cost data for some items)' : ''}\n`;
    content += `• Net Profit: ${formatCurrency(netProfit)}\n`;
    content += `• Profit Margin %: ${totalRevenue > 0 ? profitMargin.toFixed(2) + '%' : '0.00%'}\n`;
    content += `• Orders Analyzed: ${orders.length}/${totalAllTimeOrders}\n\n`;

    content += `### Performance Interpretation\n`;
    if (missingCostData) {
        content += `Warning: Profitability metrics are based on partial cost data. Recommendation: Update cost prices for all medicines to enable 100% accurate financial tracking. `;
    }
    content += `The current margin of ${profitMargin.toFixed(2)}% ${profitMargin < 20 ? 'is below standard targets. Suggestion: Renegotiate vendor contracts or focus on high-margin product sales.' : 'indicates strong operational efficiency.'}`;

    return { role: 'agent', content, type: 'analysis' };
}

async function getLowStock() {
    const threshold = 10;
    const medicines = await Medicine.find({ stock: { $lt: threshold } });

    let content = `## Low Stock Inventory Report\n\n`;
    medicines.forEach(m => {
        content += `• **${m.name}:** Current Stock: **${m.stock}** units | Reorder Level: ${m.reorderLevel || 10}\n`;
    });

    if (medicines.length === 0) content += "✅ All medicines are currently above the safety threshold of **10** units.\n";

    content += `\n### Business Insight\n`;
    if (medicines.length > 0) {
        content += `Critical Warning: **${medicines.length}** medicines are near stock-out. Recommendation: Create a priority purchase order for these items today to avoid service disruption and revenue loss.`;
    } else {
        content += `Inventory maintenance is optimal. Maintain current monitoring schedules.`;
    }

    return { role: 'agent', content, type: 'alert' };
}

async function getTopSellingMedicines(isChart = false) {
    const orders = await Order.find().populate('items.medicineId');
    const sales = {};

    orders.forEach(o => {
        o.items.forEach(item => {
            if (item.medicineId) {
                const name = item.medicineId.name;
                sales[name] = (sales[name] || 0) + item.quantity;
            }
        });
    });

    const topItems = Object.entries(sales)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    if (isChart) {
        return {
            role: 'agent',
            type: 'chart',
            data: {
                chartTitle: "Top Selling Medicines (by Volume)",
                chartType: "Bar Chart",
                labels: topItems.map(i => i[0]),
                datasets: [{
                    label: "Units Sold",
                    data: topItems.map(i => i[1])
                }],
                insights: `Analysis reveals ${topItems[0]?.[0] || 'N/A'} as the market leader. Business Recommendation: Ensure premium shelf placement and prioritized inventory refills for these top-performing assets.`
            }
        };
    }

    let content = `## Top Selling Medicines (Market Analysis)\n\n`;
    topItems.forEach(([name, qty], index) => {
        content += `${index + 1}. **${name}**: **${qty}** units sold\n`;
    });

    if (topItems.length === 0) content += "No documented sales data available for ranking.\n";

    content += `\n### Business Insight\n`;
    if (topItems.length > 0) {
        content += `Product performance analysis indicates ${topItems[0][0]} is the highest volume driver. Strategy: Ensure these top 5 items have 25% extra safety stock buffer given their high turnover rate.`;
    }

    return { role: 'agent', content, type: 'ranking' };
}

async function getMonthlyRevenueTrend() {
    const startOfYear = new Date();
    startOfYear.setMonth(0, 1);

    const orders = await Order.find({ orderDate: { $gte: startOfYear } });
    const monthlyRevenue = new Array(12).fill(0);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    orders.forEach(o => {
        const month = new Date(o.orderDate).getMonth();
        monthlyRevenue[month] += (o.totalAmount || 0);
    });

    return {
        role: 'agent',
        type: 'chart',
        data: {
            chartTitle: "Monthly Revenue Trend",
            chartType: "Line Chart",
            labels: monthNames,
            datasets: [{
                label: "Revenue (₹)",
                data: monthlyRevenue
            }],
            insights: "Revenue fluctuations identified across quarters. Business Recommendation: Analyze low-performing months for seasonal gaps and implement loyalty campaigns to stabilize cash flow."
        }
    };
}

async function getOrderStatusDistribution() {
    const allowedStatuses = ['PENDING', 'CONFIRMED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];

    // Fetch all relevant orders to process grouping manually for accuracy
    const orders = await Order.find().select('status');

    const counts = {};
    allowedStatuses.forEach(s => counts[s] = 0);

    orders.forEach(order => {
        let status = order.status || 'PENDING';
        if (status === 'PROCESSING') status = 'CONFIRMED';
        if (status === 'SHIPPED') status = 'OUT_FOR_DELIVERY';
        if (status === 'REJECTED') status = 'CANCELLED';

        if (allowedStatuses.includes(status)) {
            counts[status]++;
        }
    });

    const filteredResults = allowedStatuses
        .filter(s => counts[s] > 0)
        .map(s => ({ name: s, value: counts[s] }));

    return {
        role: 'agent',
        type: 'chart',
        data: {
            chartTitle: "Order Status Breakdown",
            chartType: "Bar Chart",
            labels: filteredResults.map(r => r.name),
            datasets: [{
                label: "Order Count",
                data: filteredResults.map(r => r.value)
            }],
            insights: `Analysis of ${orders.length} orders across ${filteredResults.length} active delivery stages.`
        }
    };
}

async function getYearlyGrowth() {
    const startOfYear = new Date();
    startOfYear.setMonth(0, 1);

    const orders = await Order.find({ orderDate: { $gte: startOfYear } });
    const cumulativeRevenue = [];
    let runningTotal = 0;
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (let i = 0; i < 12; i++) {
        const monthTotal = orders.filter(o => new Date(o.orderDate).getMonth() === i)
            .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        runningTotal += monthTotal;
        cumulativeRevenue.push(runningTotal);
    }

    return {
        role: 'agent',
        type: 'chart',
        data: {
            chartTitle: "Yearly Growth Analysis (Cumulative)",
            chartType: "Area Chart",
            labels: monthNames,
            datasets: [{
                label: "Cumulative Revenue (₹)",
                data: cumulativeRevenue
            }],
            insights: "Sustained upward trajectory indicates market expansion. Business Recommendation: Scale operations in line with current growth to maintain quality standards."
        }
    };
}

async function getProfitComparison() {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);

    const orders = await Order.find({ orderDate: { $gte: startOfMonth } }).populate('items.medicineId');
    let totalRevenue = 0;
    let totalCOGS = 0;

    orders.forEach(o => {
        totalRevenue += (o.totalAmount || 0);
        o.items.forEach(item => {
            if (item.medicineId?.costPrice) {
                totalCOGS += (item.medicineId.costPrice * item.quantity);
            }
        });
    });

    return {
        role: 'agent',
        type: 'chart',
        data: {
            chartTitle: "Revenue vs Cost Comparison",
            chartType: "Bar Chart",
            labels: ["Revenue", "COGS", "Net Profit"],
            datasets: [{
                label: "Financial Overview (Current Month)",
                data: [totalRevenue, totalCOGS, totalRevenue - totalCOGS]
            }],
            insights: "Direct comparison of gross income versus inventory expenditure. Business Recommendation: Focus on high-margin product procurement to increase the gap between COGS and Revenue."
        }
    };
}

async function getPredictiveRestock() {
    const medicines = await Medicine.find();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const orders = await Order.find({ orderDate: { $gte: thirtyDaysAgo } });

    const predictions = [];

    medicines.forEach(med => {
        let totalSoldLast30Days = 0;
        orders.forEach(o => {
            const item = o.items.find(i => i.medicineId?.toString() === med._id.toString());
            if (item) totalSoldLast30Days += item.quantity;
        });

        const velocity = totalSoldLast30Days / 30; // units per day
        if (velocity > 0) {
            const daysRemaining = Math.floor(med.stock / velocity);
            if (daysRemaining <= 14) { // Only show items running out in next 2 weeks
                predictions.push({
                    name: med.name,
                    stock: med.stock,
                    velocity: velocity.toFixed(2),
                    daysLeft: daysRemaining
                });
            }
        }
    });

    predictions.sort((a, b) => a.daysLeft - b.daysLeft);

    const chartLabels = predictions.map(p => p.name);
    const chartData = predictions.map(p => p.daysLeft);

    return {
        role: 'agent',
        type: 'chart',
        data: {
            chartTitle: "Stock Depletion Forecast (Days Remaining)",
            chartType: "Bar Chart",
            labels: chartLabels,
            datasets: [{
                label: "Days Until Stock-out",
                data: chartData
            }],
            insights: predictions.length > 0
                ? `Forecast indicates ${predictions.length} items will deplete within two weeks. Action: Authorize restock orders for items with less than 7 days remaining (${predictions.filter(p => p.daysLeft < 7).map(p => p.name).join(', ') || 'None'}) immediately.`
                : "Inventory velocity analysis suggests no critical stock-outs within the next 14 days. Sales velocity is currently matched by inventory levels."
        }
    };
}
