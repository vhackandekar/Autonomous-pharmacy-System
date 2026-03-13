# 🏥 Autonomous Pharmacy System (PHARMACY-AI)

[![Status](https://img.shields.io/badge/Status-In--Development-yellow)](https://github.com/vhackandekar/Autonomous-pharmacy-System)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![AI-Powered](https://img.shields.io/badge/AI-TrOCR%20%2B%20EasyOCR-green)](ai_service/)

**A premium, high-fidelity AI-driven platform for automated prescription processing and pharmacy management.**

---

## 🌟 Overview

The **Autonomous Pharmacy System** is a next-generation ecosystem designed to bridge the gap between handwritten medical prescriptions and digital healthcare management. By leveraging advanced OCR models and a microservices architecture, the system provides a seamless experience for patients, administrators, and vendors.

### Core Value Proposition
- **Precision AI**: Hybrid OpenCV + EasyOCR + TrOCR pipeline for recognizing complex medical handwriting.
- **Microservices Architecture**: Decoupled AI, Backend, and Frontend services for maximum scalability.
- **Premium UI**: "Crystal Prism" design aesthetic providing a luxurious, state-of-the-art user experience.
- **Real-time Synchronization**: Automated background tasks and real-time notifications for order tracking.

---

## 🏗️ System Architecture

The project is divided into specialized modules work in harmony:

| Module | Purpose | Tech Stack |
|:---|:---|:---|
| **[AI Service](file:///c:/Users/PRERNA/OneDrive/Desktop/Folder-hackFusion/ai_service)** | Prescription recognition & enhancement | Python, FastAPI, TrOCR, EasyOCR |
| **[Backend](file:///c:/Users/PRERNA/OneDrive/Desktop/Folder-hackFusion/backend)** | Business logic, API & Data Orchestration | Node.js, Express, MongoDB, Socket.IO |
| **[Admin Portal](file:///c:/Users/PRERNA/OneDrive/Desktop/Folder-hackFusion/admin)** | Management dashboard & clinical oversight | React, Vite, Recharts, Framer Motion |
| **[Frontend (User)](file:///c:/Users/PRERNA/OneDrive/Desktop/Folder-hackFusion/frontend/userdashboard)** | Patient-facing dashboard & ordering | React (v19), Tailwind CSS, Framer Motion |

---

## 🚀 Key Features

### 🤖 Intelligent Prescription Processing
- **Image Enhancement**: Adaptive thresholding and denoising using OpenCV.
- **Handwritten Recognition**: TrOCR-based decoding specialized for medical handwriting.
- **Hybrid Validation**: Multi-engine OCR consensus for high confidence scores.

### 💼 Powerful Administration
- **Real-time Monitoring**: Socket.IO integration for instant order updates.
- **Inventory Management**: Automated stock alerts and vendor coordination.
- **Analytics**: Deep insights into pharmacy performance using Recharts.

### 📱 Premium Patient Experience
- **One-click Upload**: Professional chatbot-like file upload interface.
- **Order Tracking**: Real-time status from checkout to delivery.
- **Cinematic Transitions**: Seamless UI/UX powered by Framer Motion.

---

## 🛠️ Getting Started

### Prerequisites
- **Node.js**: v18 or higher
- **Python**: v3.9 or higher (with CUDA support for AI acceleration)
- **MongoDB**: Atlas or local instance

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/vhackandekar/Autonomous-pharmacy-System.git
   cd Autonomous-pharmacy-System
   ```

2. **Setup AI Service**
   ```bash
   cd ai_service
   pip install -r requirements.txt
   python main.py
   ```

3. **Setup Backend**
   ```bash
   cd ../backend
   npm install
   # Create .env based on .env.example
   npm start
   ```

4. **Setup Portals**
   ```bash
   # For Admin
   cd ../admin && npm install && npm run dev
   # For User Dashboard
   cd ../frontend/userdashboard && npm install && npm run dev
   ```

---

## 🛡️ License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  <b>Built for Modern Digital Healthcare Solutions</b>
</p>