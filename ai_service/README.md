# 🤖 Advanced Prescription AI Service

This service provides a high-performance, hybrid OCR pipeline designed specifically for recognizing and extracting text from medical prescriptions using state-of-the-art vision models.

---

## 🚀 Overview

The **AI Service** is a decoupled Python-based microservice that handles the heavy lifting of image processing and text recognition. It combines traditional computer vision with modern deep learning for maximum accuracy.

### Key Capabilities
- **Image Enhancement**: Specialized OpenCV filters to remove noise and improve contrast in scanned prescriptions.
- **Hybrid OCR**: consensus-based recognition using **EasyOCR** for layout detection and **TrOCR (Transformer-based Optical Character Recognition)** for high-accuracy handwriting decoding.
- **Hardware-Accelerated**: Native support for CUDA/GPU processing to ensure millisecond-level response times.

---

## 🏗️ Architecture & Pipeline

The recognition process follows a 3-step sequence:
1. **Enhancement**: OpenCV-based grayscale conversion, denoising, and adaptive thresholding.
2. **Layout Detection**: EasyOCR identifies text regions and overall document structure.
3. **Deep Decoding**: TrOCR (Microsoft-base-handwritten) performs the final text recognition on the enhanced image.

---

## 🛠️ API Reference

### Health Check
`GET /`
- **Response**: `{"status": "online", "device": "cuda/cpu", "pipeline": "..."}`

### Process Prescription
`POST /process-prescription`
- **Payload**: `file` (Multipart/form-data)
- **Response**:
  ```json
  {
    "success": true,
    "raw_text": "Amoxicillin 500mg...",
    "confidence": 0.92,
    "engine": "Hybrid-OpenCV-TrOCR"
  }
  ```

---

## 📦 Setup & Installation

### Requirements
- Python 3.9+
- CUDA-enabled GPU (optional, but highly recommended)

### Instructions
1. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
2. **Launch the service**:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```

---

<p align="center">
  <b>Powering Digital Pharmacy Intelligence</b>
</p>
