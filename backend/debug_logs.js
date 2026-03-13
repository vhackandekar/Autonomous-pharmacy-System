const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
    await mongoose.connect(process.env.MONGODB_URL);
    const AgentLog = mongoose.model('AgentLog', require('./schema/AgentLog').schema);

    const userId = "699f18190f442f4bc464c447";
    const logs = await AgentLog.find({ userId }).sort({ timestamp: -1 }).limit(10);

    logs.forEach(l => {
        console.log(`[${l.timestamp.toISOString()}] Intent: ${l.intent} | Status: ${l.workflowStatus}`);
        console.log(`User: ${l.userMessage}`);
        console.log(`Agent: ${l.agentResponse.substring(0, 100)}...`);
        console.log('---');
    });

    process.exit(0);
}

run();
