const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
    await mongoose.connect(process.env.MONGODB_URL);
    const Prescription = mongoose.model('Prescription', require('./schema/Prescription').schema);
    const Medicine = mongoose.model('Medicine', require('./schema/Medicine').schema);

    const meds = await Medicine.find({ name: { $regex: /Amoxicillin|Metformin/i } });
    const medIds = meds.map(m => m._id);

    const userId = "699f18190f442f4bc464c447"; // From logs
    const prescs = await Prescription.find({ userId }).populate('medicineId');

    console.log("MEDICINES FOUND:", JSON.stringify(meds.map(m => ({ id: m._id, name: m.name })), null, 2));
    console.log("PRESCRIPTIONS FOUND:", JSON.stringify(prescs.map(p => ({
        id: p._id,
        medicine: p.medicineId?.name,
        status: p.status,
        validTill: p.validTill,
        isUsed: p.isUsed,
        isReusable: p.isReusable
    })), null, 2));

    process.exit(0);
}

run();
