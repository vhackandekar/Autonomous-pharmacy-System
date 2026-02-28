# 📊 Visual Diagrams - Prescription Validation Flow

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                             │
│  ┌──────────────────────┐  ┌──────────────────────┐                │
│  │  Chat Upload         │  │  Direct Upload       │                │
│  │  (/agent/chat/upload)│  │  (/prescription/      │                │
│  │                      │  │    upload)           │                │
│  └──────────┬───────────┘  └──────────┬───────────┘                │
│             │                         │                             │
└─────────────┼─────────────────────────┼─────────────────────────────┘
              │                         │
              ▼                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKEND (Express.js)                             │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  agentController.js :: chatUpload()                        │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │ 1. Parse upload & find target medicine              │  │   │
│  │  │ 2. Call PrescriptionAgent.analyzePrescription()     │  │   │
│  │  │ 3. 🆕 Call validateMedicineInPrescription()         │  │   │
│  │  │ 4. If invalid: Return error (no save)               │  │   │
│  │  │ 5. If valid: Save & return success                  │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  prescriptionController.js :: uploadPrescription()         │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │ 1. Create Prescription record (status: UPLOADED)     │  │   │
│  │  │ 2. Start background processOCRTask()                │  │   │
│  │  │    (Runs async, user gets immediate response)       │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  │                                                              │   │
│  │  Background Task: processOCRTask()                          │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │ 1. Call PrescriptionAgent.analyzePrescription()     │  │   │
│  │  │ 2. 🆕 Call validateMedicineInPrescription()         │  │   │
│  │  │ 3. If invalid:                                      │  │   │
│  │  │    - Set status = REJECTED                          │  │   │
│  │  │    - Add rejection reason to notes                  │  │   │
│  │  │    - Notify user (don't send to admin)              │  │   │
│  │  │ 4. If valid:                                        │  │   │
│  │  │    - Set status = PENDING_ADMIN_REVIEW              │  │   │
│  │  │    - Notify admin                                   │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  prescriptionController.js :: validatePrescription()       │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │ At checkout, verify prescription is valid:          │  │   │
│  │  │ 1. Get prescription from DB                         │  │   │
│  │  │ 2. 🆕 Check medicineValidation in extractedData     │  │   │
│  │  │ 3. If invalid: Return valid=false                   │  │   │
│  │  │ 4. If valid: Allow purchase                         │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  PrescriptionAgent.js                                      │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │ 1. analyzePrescription(): Tesseract OCR             │  │   │
│  │  │    - Returns: confidence, detectedMedicines,        │  │   │
│  │  │      doctorName, issuedDate, dosage               │  │   │
│  │  │                                                     │  │   │
│  │  │ 2. 🆕 validateMedicineInPrescription():             │  │   │
│  │  │    - Exact match (case-insensitive)                │  │   │
│  │  │    - Fuzzy match (Levenshtein distance ≤ 2)       │  │   │
│  │  │    - Alternate names (brand names, synonyms)       │  │   │
│  │  │    - Returns: isValid, reason, details             │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
              │                         │
              │                         │
              ▼                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    DATABASE (MongoDB)                               │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Collection: prescriptions                                 │   │
│  │  {                                                         │   │
│  │    _id, userId, medicineId,                              │   │
│  │    status: "PENDING_ADMIN_REVIEW",                        │   │
│  │    extractedData: {                                        │   │
│  │      confidence, detectedMedicines,                        │   │
│  │      doctorName, issuedDate, dosage,                     │   │
│  │      🆕 medicineValidation: {                             │   │
│  │        isValid, reason, matchedMedicine                  │   │
│  │      }                                                    │   │
│  │    }                                                       │   │
│  │  }                                                          │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Decision Flow: Medicine Validation

```
                    ┌─────────────────────────┐
                    │   User uploads file:    │
                    │ medicineId="Aspirin"    │
                    │ image file              │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │  Tesseract.js OCR       │
                    │  Extract: ["Aspirin"]   │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼──────────────┐
                    │🆕 VALIDATE MEDICINE MATCH  │
                    │                            │
                    │ Requested: Aspirin         │
                    │ Detected:  ["Aspirin"]     │
                    │                            │
                    │ Match Strategy:            │
                    │ 1. Exact?   "aspirin"=="aspirin" ✅
                    └────────────┬───────────────┘
                                 │
                          Match Found
                                 │
                ┌────────────────┴────────────────┐
                │                                 │
                ▼ VALID ✅                 ❌ INVALID
        ┌──────────────────┐        ┌───────────────────┐
        │ Save Prescription│        │  AUTO-REJECT      │
        │ Status =         │        │  Status = REJECTED│
        │ PENDING_ADMIN... │        │  Add reason to    │
        │                  │        │  validationNotes  │
        │ Notify admin     │        │  Notify user only │
        │ (show in dash)   │        │ (don't show admin)│
        └────────┬─────────┘        └───────────────────┘
                 │
        Admin Review
                 │
                 ├──APPROVE──▶ Status = VERIFIED
                 │
                 └──REJECT───▶ Status = REJECTED


        Alternate Match Examples:
        
        ┌─────────────────────────────────────┐
        │ 1. EXACT MATCH                      │
        │    "Aspirin" = "aspirin"            │
        │    Result: ✅ EXACT_MATCH          │
        └─────────────────────────────────────┘
        
        ┌─────────────────────────────────────┐
        │ 2. FUZZY MATCH (OCR Error)          │
        │    Requested: "Paracetamol"         │
        │    Detected:  "Paracetamoi"         │
        │    Distance:  1 char difference     │
        │    Result: ✅ FUZZY_MATCH          │
        └─────────────────────────────────────┘
        
        ┌─────────────────────────────────────┐
        │ 3. MEDICINE MISMATCH                │
        │    Requested: "Aspirin"             │
        │    Detected:  "Ibuprofen"           │
        │    Result: ❌ MEDICINE_MISMATCH    │
        │ Auto-reject, user re-uploads       │
        └─────────────────────────────────────┘
```

---

## Checkout Validation Flow

```
                 ┌──────────────────────┐
                 │ User at Checkout     │
                 │ Buying: Aspirin      │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────────┐
                 │ validatePrescription()   │
                 │ ?Have prescription for   │
                 │  Aspirin?               │
                 └──────────┬───────────────┘
                            │
                 ┌──────────▼───────────┐
                 │ Query DB:            │
                 │ Find where:          │
                 │ - userId = current   │
                 │ - medicineId = Asp.. │
                 │ - status = VERIFIED  │
                 │ - validTill > today  │
                 └──────────┬───────────┘
                            │
                    ┌───────┴────────┐
                    │                │
                ✅ FOUND        ❌ NOT FOUND
                    │                │
                    ▼                ▼
            ┌─────────────────┐  Not allowed
            │ Found script    │  to buy
            │ 🆕 Cross-check: │  Error to user
            │ Does it mention │
            │ Aspirin?        │
            └────────┬────────┘
                     │
            ┌────────┴─────────┐
            │                  │
         ✅ YES             ❌ NO
         (in extracted)    (mismatch)
            │                  │
            ▼                  ▼
    ✅ ALLOW PURCHASE   ❌ BLOCK
                    Message:
                    "Prescription
                    doesn't mention
                    Aspirin"
```

---

## Status Lifecycle (Updated)

```
                    Upload
                       │
                       ▼
            ┌──────────────────────┐
            │    UPLOADED          │
            │ (file stored)        │
            └──────────┬───────────┘
                       │
          Background Processing Starts
                       │
                       ▼
           ┌─────────────────────────┐
           │  OCR Analysis           │
           │  Extract medicines,     │
           │  doctor, date, dosage   │
           └──────────┬──────────────┘
                      │
          🆕 VALIDATE MEDICINE MATCH
                      │
            ┌─────────┴──────────┐
            │                    │
         ✅ MATCH           ❌ MISMATCH
            │                    │
            ▼                    ▼
    SET STATUS             SET STATUS
    PENDING_ADMIN_REVIEW    REJECTED
    (show to admin)         (user notified)
            │                    │
            │            User re-uploads
            │            correct prescription
            │
        Admin Reviews
            │
       ┌────┴─────┐
       │           │
    APPROVE    REJECT
       │           │
       ▼           ▼
    VERIFIED    REJECTED
    ✅ Ready   ❌ Stop
    for cart
       │
       ▼
    User can
    checkout
    with meds
```

---

## State Transitions Before & After

### ❌ BEFORE (Buggy)

```
Upload Asp → OCR finds Ibu → No validation → PENDING_ADMIN → 
Admin confused → Approves anyway → VERIFIED (wrong!) → 
User buys Ibuprofen thinking it's Aspirin 💥
```

### ✅ AFTER (Fixed)

```
Upload Asp → OCR finds Ibu → Validate: Asp in [Ibu]? NO → 
REJECTED immediately → User notified → User re-uploads 
correct Aspirin doc → OCR finds Asp → Validate: Asp in 
[Asp]? YES → PENDING_ADMIN → Admin approves → VERIFIED ✅ → 
User buys correct medicine
```

---

## Error Response Examples

### Response 1: Wrong Medicine Uploaded (Chat Interface)

```json
{
  "agentResponse": {
    "answer": "The prescription does not mention Aspirin. Found: Ibuprofen. Please upload the correct prescription.",
    "intent": "UPLOAD_REJECTION",
    "reason": "MEDICINE_MISMATCH"
  }
}
```

### Response 2: Wrong Medicine at Checkout

```json
{
  "valid": false,
  "status": "MISMATCH",
  "message": "Prescription validation failed: MEDICINE_MISMATCH",
  "details": {
    "isValid": false,
    "reason": "MEDICINE_MISMATCH",
    "requestedMedicine": "Aspirin",
    "detectedMedicines": ["Ibuprofen"]
  }
}
```

### Response 3: Auto-Rejected in Background Task

```javascript
// Database stores:
{
  _id: ObjectId(...),
  status: "REJECTED",
  extractedData: {
    confidence: 92,
    detectedMedicines: ["Ibuprofen"],
    medicineValidation: {
      isValid: false,
      reason: "MEDICINE_MISMATCH",
      requestedMedicine: "Aspirin",
      detectedMedicines: ["Ibuprofen"]
    },
    validationNotes: 
      "REJECTED: MEDICINE_MISMATCH. Requested: Aspirin. Found: Ibuprofen"
  }
}

// User is notified:
// "Your prescription upload for Aspirin was rejected because the document shows Ibuprofen."
```

---

## Testing Matrix

```
┌─────────────────────────────────────────────────────────────────┐
│  TEST CASE                  REQUESTED  DETECTED   EXPECTED      │
├─────────────────────────────────────────────────────────────────┤
│  1. Correct script          Aspirin    [Aspirin]  ✅ ACCEPT     │
│  2. Wrong medicine          Aspirin    [Ibuprofen]❌ REJECT    │
│  3. OCR error (fuzzy)       Paracet.   [Paracetamoi]✅ ACCEPT  │
│  4. Multiple meds, 1 match  Aspirin    [Ibu,Asp]  ✅ ACCEPT     │
│  5. Multiple meds, no match Aspirin    [Ibu,Parac]❌ REJECT    │
│  6. No medicines detected   Aspirin    []         ❌ REJECT    │
│  7. Case insensitive        Aspirin    [aspirin]  ✅ ACCEPT     │
│  8. Alt names               Aspirin    [Ecotrin]  ✅ ACCEPT     │
│  9. Blank prescription      Aspirin    [blank]    ❌ REJECT    │
│ 10. Partially visible       Aspirin    [Asp...]   ✅ FUZZY      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Timeline

```
T=0s   ┌─────────────┐
       │ User uploads│
       │ Prescription│
       └──────┬──────┘
              │
T=0.1s ┌──────▼────────────────┐
       │ Instant response to   │
       │ user: "Processing..."  │
       │ (for chat) or 201 Created
       │ (for direct upload)    │
       └──────┬────────────────┘
              │
T=0s-∞ ┌──────▼────────────────────────────┐
(bg)   │ Background processOCRTask():      │
       │ - Run OCR (takes OCR image)      │
       │ - Validate medicine match        │
       │ - Update DB status               │
       │ - Notify user via socket.io      │
       │ - Notify admin if valid          │
       └──────┬────────────────────────────┘
              │
T=?s   ┌──────▼─────────────────────┐
       │ User updates in real-time   │
       │ - Wrong: rejected instantly │
       │ - Right: pending approval   │
       └─────────────────────────────┘
```

---

## Confidence Flow

```
User Submits Prescription
        │
        ├─ medicine match? ───┬─── YES (EXACT) ────► HIGH CONFIDENCE
        │                     │
        │                     ├─── FUZZY ────────── MEDIUM CONFIDENCE
        │                     │
        │                     ├─── ALTERNATE NAME ─ MEDIUM CONFIDENCE
        │                     │
        │                     └─── NO ────────────► REJECTED
        │
        └────────────────────────────────────────► REJECTED (don't cont.)


        Final Status:
        - EXACT_MATCH + HIGH OCR conf   → PENDING_ADMIN_REVIEW
        - FUZZY_MATCH + HIGH OCR conf   → PENDING_ADMIN_REVIEW
        - MEDICINE_MISMATCH             → REJECTED (skip admin)
        - NO_MEDICINES_DETECTED         → REJECTED
```

These diagrams should help you understand the complete flow! 🎯
