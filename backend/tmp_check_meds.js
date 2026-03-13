const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    const Medicine = mongoose.model('Medicine', new mongoose.Schema({ name: String, prescriptionRequired: Boolean }));
    const meds = await Medicine.find({ name: { $regex: /Aspirin|Metformin/i } });
    console.log(JSON.stringify(meds, null, 2));
    process.exit(0);
}

run();
