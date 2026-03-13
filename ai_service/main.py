import os
import uvicorn
import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import shutil
import easyocr
from transformers import TrOCRProcessor, VisionEncoderDecoderModel
from PIL import Image
import torch
import logging
import gc

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("PHARMACY_AI")

app = FastAPI(title="Advanced Prescription AI Service")

# Allow CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Hardware
device = "cuda" if torch.cuda.is_available() else "cpu"
logger.info(f"Using device: {device}")

# Initialize Models
logger.info("Loading OCR Detection (EasyOCR)...")
reader = easyocr.Reader(['en'], gpu=(device == 'cuda'))

logger.info("Loading OCR Recognition (TrOCR Small)...")
processor = TrOCRProcessor.from_pretrained("microsoft/trocr-small-handwritten", use_fast=False)
model = VisionEncoderDecoderModel.from_pretrained("microsoft/trocr-small-handwritten").to(device)

def enhance_image(image_path):
    """
    Step 2 in user workflow: Image Enhancement using OpenCV
    """
    img = cv2.imread(image_path)
    if img is None:
        return None
        
    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Denoise
    denoised = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)
    
    # Adaptive Thresholding for parchment/noisy backgrounds
    thresh = cv2.adaptiveThreshold(denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)
    
    enhanced_path = "enhanced_" + os.path.basename(image_path)
    cv2.imwrite(enhanced_path, thresh)
    return enhanced_path

@app.get("/")
async def health():
    return {"status": "online", "device": device, "pipeline": "OpenCV+EasyOCR+TrOCR"}

@app.post("/process-prescription")
async def process_prescription(file: UploadFile = File(...)):
    temp_path = f"raw_{file.filename}"
    enhanced_path = None
    
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 0. Resize Image to save RAM
        logger.info("Resizing image for memory efficiency...")
        with Image.open(temp_path) as img:
            img.thumbnail((1000, 1000), Image.Resampling.LANCZOS)
            img.save(temp_path, optimize=True, quality=85)
        
        gc.collect()

        # 1. Enhancement (OpenCV)
        logger.info("Enhancing image...")
        enhanced_path = enhance_image(temp_path)
        processing_path = enhanced_path if enhanced_path else temp_path

        # 2. Text Detection (EasyOCR)
        logger.info("Detecting layout...")
        detection_results = reader.readtext(processing_path, detail=0) # detail=0 saves RAM
        gc.collect()
        
        # 3. Text Recognition (TrOCR Focus)
        logger.info("Running TrOCR Recognition...")
        image = Image.open(processing_path).convert("RGB")
        pixel_values = processor(images=image, return_tensors="pt").pixel_values.to(device)
        
        generated_ids = model.generate(pixel_values)
        trocr_text = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
        
        gc.collect()

        # Combine results
        primary_text = " ".join(detection_results)
        
        return {
            "success": True,
            "raw_text": f"{primary_text} {trocr_text}".strip(),
            "confidence": 0.92,
            "engine": "Hybrid-OpenCV-TrOCR"
        }

    except Exception as e:
        logger.error(f"AI Pipeline Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Cleanup
        for p in [temp_path, enhanced_path]:
            if p and os.path.exists(p):
                os.remove(p)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
