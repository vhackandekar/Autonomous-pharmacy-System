const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
    await mongoose.connect(process.env.MONGODB_URL);
    const AgentLog = mongoose.model('AgentLog', require('./schema/AgentLog').schema);

    // Find logs from the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentLogs = await AgentLog.find({ timestamp: { $gt: oneHourAgo } }).sort({ timestamp: -1 });

    if (recentLogs.length === 0) {
        console.log("No logs found in the last hour.");
        // Try last 24 hours
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const dayLogs = await AgentLog.find({ timestamp: { $gt: oneDayAgo } }).sort({ timestamp: -1 }).limit(10);
        console.log("Recent logs (24h):", JSON.stringify(dayLogs.map(l => ({ userId: l.userId, msg: l.userMessage, ts: l.timestamp })), null, 2));
    } else {
        console.log("Recent logs (1h):", JSON.stringify(recentLogs.map(l => ({ userId: l.userId, msg: l.userMessage, ts: l.timestamp })), null, 2));
    }

    process.exit(0);
}

run();
