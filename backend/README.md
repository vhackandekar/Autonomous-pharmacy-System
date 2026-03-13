# ⚙️ Pharmacy Backend (API & Orchestration)

The core engine of the Autonomous Pharmacy System, responsible for business logic, data persistence, and real-time synchronization across all services.

---

## 🚀 Overview

The **Backend** is built with Node.js and Express, providing a robust and secure API for the Admin and User dashboards. It manages the integration with the AI Service, handles real-time notifications via Socket.IO, and orchestrates the entire order fulfillment lifecycle.

### Core Features
- **Centralized API**: RESTful endpoints for user auth, inventory, orders, and clinical prescriptions.
- **Real-time Engine**: Powered by Socket.IO for instant administrative alerts and order updates.
- **Automated Tasks**: Integrated CRON jobs for stock monitoring and refill predictions.
- **Robust Security**: JWT-based authentication and clinical-grade error handling.

---

## 🏗️ Architecture

The backend follows a controller-route-middleware pattern:
- **Controllers**: Handle business logic (e.g., `prescriptionController.js`).
- **Middleware**: Manages security, validation, and error handling.
- **Real-time**: Custom Socket.IO implementation with room-based notifications.

---

## 🛠️ API Architecture

The system exposes specialized route modules:

| Route Path | Responsibility |
|:---|:---|
| `/api/auth` | User & Admin authentication |
| `/api/medicine` | Pharmacy inventory management |
| `/api/prescription` | OCR integration & prescription review |
| `/api/order` | Order processing & cart management |
| `/api/notify` | Real-time & scheduled notifications |

---

## 📦 Setup & Installation

### Prerequisites
- Node.js v18+
- MongoDB instance (Atlas or Local)

### Instructions
1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Environment Configuration**:
   Create a `.env` file based on `.env.example`.
3. **Launch the server**:
   ```bash
   npm start
   ```

---

<p align="center">
  <b>The Backbone of Digital Healthcare Automation</b>
</p>
