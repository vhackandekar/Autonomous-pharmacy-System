/**
 * Test: Medicine Validation in Prescription System
 * 
 * This test validates that:
 * 1. Prescriptions with mismatched medicines are REJECTED
 * 2. Prescriptions with matching medicines are ACCEPTED
 * 3. Fuzzy matching handles OCR errors correctly
 */

const mongoose = require('mongoose');
const Medicine = require('./schema/Medicine');
const PrescriptionAgent = require('./Agents/PrescriptionAgent');

// Sample test data
const TEST_CASES = [
    {
        name: 'EXACT MATCH',
        requestedMedicine: 'Aspirin',
        detectedMedicines: ['Aspirin'],
        expectedValid: true,
        expectedReason: 'EXACT_MATCH'
    },
    {
        name: 'MEDICINE MISMATCH',
        requestedMedicine: 'Aspirin',
        detectedMedicines: ['Ibuprofen'],
        expectedValid: false,
        expectedReason: 'MEDICINE_MISMATCH'
    },
    {
        name: 'FUZZY MATCH (OCR ERROR)',
        requestedMedicine: 'Paracetamol',
        detectedMedicines: ['Paracetamoi'], // Missing last letter
        expectedValid: true,
        expectedReason: 'FUZZY_MATCH'
    },
    {
        name: 'NO MEDICINES DETECTED',
        requestedMedicine: 'Aspirin',
        detectedMedicines: [],
        expectedValid: false,
        expectedReason: 'NO_MEDICINES_IN_PRESCRIPTION'
    },
    {
        name: 'MULTIPLE MEDICINES - ONE MATCHES',
        requestedMedicine: 'Aspirin',
        detectedMedicines: ['Ibuprofen', 'Aspirin', 'Metformin'],
        expectedValid: true,
        expectedReason: 'EXACT_MATCH'
    }
];

async function runTests() {
    console.log('\n🧪 MEDICINE VALIDATION TEST SUITE\n');
    console.log('━'.repeat(60));

    let passed = 0;
    let failed = 0;

    for (const testCase of TEST_CASES) {
        console.log(`\n📋 Test: ${testCase.name}`);
        console.log(`   Requested: ${testCase.requestedMedicine}`);
        console.log(`   Detected: ${testCase.detectedMedicines.join(', ') || '(none)'}`);

        try {
            // Get or create medicine for testing
            let medicine = await Medicine.findOne({ name: testCase.requestedMedicine });
            
            if (!medicine) {
                console.log(`   ⚠️  Creating test medicine: ${testCase.requestedMedicine}`);
                medicine = new Medicine({
                    name: testCase.requestedMedicine,
                    category: 'Test',
                    price: 10,
                    stock: 100,
                    prescriptionRequired: true
                });
                await medicine.save();
            }

            // Run validation
            const result = await PrescriptionAgent.validateMedicineInPrescription(
                medicine._id,
                testCase.detectedMedicines
            );

            // Check result
            const isValid = result.isValid === testCase.expectedValid;
            const reasonMatch = result.reason === testCase.expectedReason;

            if (isValid && reasonMatch) {
                console.log(`   ✅ PASSED`);
                console.log(`   Valid: ${result.isValid} (expected: ${testCase.expectedValid})`);
                console.log(`   Reason: ${result.reason} (expected: ${testCase.expectedReason})`);
                passed++;
            } else {
                console.log(`   ❌ FAILED`);
                if (!isValid) {
                    console.log(`   Valid: ${result.isValid} ❌ (expected: ${testCase.expectedValid})`);
                }
                if (!reasonMatch) {
                    console.log(`   Reason: ${result.reason} ❌ (expected: ${testCase.expectedReason})`);
                }
                console.log(`   Full result:`, JSON.stringify(result, null, 2));
                failed++;
            }
        } catch (error) {
            console.log(`   ❌ ERROR: ${error.message}`);
            failed++;
        }
    }

    console.log(`\n━`.repeat(60));
    console.log(`\n📊 RESULTS: ${passed} passed, ${failed} failed`);

    if (failed === 0) {
        console.log('✅ All tests passed!\n');
    } else {
        console.log(`⚠️  ${failed} test(s) failed\n`);
    }

    process.exit(failed > 0 ? 1 : 0);
}

// Connect and run
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/pharmacy', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('✅ Connected to MongoDB');
    runTests().catch(err => {
        console.error('Test suite error:', err);
        process.exit(1);
    });
}).catch(err => {
    console.error('❌ MongoDB connection failed:', err);
    process.exit(1);
});
