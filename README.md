# ClassCore — Tuition Management System

![Version](https://img.shields.io/badge/version-2.0.0-green)
![Platform](https://img.shields.io/badge/platform-Windows-blue)
![License](https://img.shields.io/badge/license-Proprietary-lightgrey)

**ClassCore** is a professional, high-performance desktop application designed for tuition center administrators to streamline their daily operations. From student enrollment and fee tracking to academic performance and financial management, ClassCore provides a centralized hub for educational administration.

## ✨ What's New in v2.0.0

- 🟢 **WhatsApp Hub** — Send receipts, PDFs, and broadcasts directly via WhatsApp from within the app (no more copy-paste!)
- 🤖 **AI Auto-Reply** — Automatically respond to student/parent inquiries on WhatsApp with customizable AI
- 🗑️ **Removed Mobile App Sync** — Simplified architecture for better performance
- 🔧 **Bug Fixes** — Improved WhatsApp button reliability across all modules

## 🚀 Key Features

### 👨‍🎓 Student & Batch Management
- **Complete Student Lifecycle:** Easy enrollment, editing, and tracking of student data.
- **Dynamic Batching:** Create and manage multiple batches with custom timings, subjects, and capacity limits.
- **Student Assignment:** Quickly assign students to batches with a one-click interface.

### 💰 Financial Suite
- **Fee Management:** Support for monthly and annual fee structures with individual student overrides.
- **Bulk Collection:** Rapidly collect fees for entire classes or batches with a single click.
- **Expense Tracking:** Record operational costs and get real-time insights into net profit and loss.
- **Receipt via WhatsApp:** Send fee receipts directly to parents via WhatsApp Hub.

### 📊 Academic Tracking
- **Exam Management:** Schedule exams and record marks for entire classes.
- **Performance Analytics:** Automatic calculation of averages and percentages per exam.
- **Professional Report Cards:** Generate and export detailed student performance reports as high-quality PDFs.

### 🟢 WhatsApp Hub (NEW in v2.0.0)
- **Direct Messaging:** Send messages and documents directly via WhatsApp — no browser redirects.
- **QR Code Login:** Scan a QR code once and stay connected.
- **Receipt Sharing:** Send fee receipts as PDF attachments with one click.
- **Broadcast Messages:** Send announcements to all parents instantly.
- **AI Auto-Reply:** Configure intelligent auto-responses for student inquiries with customizable business info, FAQs, and rate cards.
- **Order Desk:** Students can place requests (like book orders) via WhatsApp.

### ⚙️ Operational Tools
- **Real-time Attendance:** Fast, toggle-based attendance marking with daily and batch-wise filters.
- **Parent Communication:** Integrated WhatsApp broadcast system to send announcements to parents instantly.
- **ID Card Generation:** Create and print professional student identity cards.

## 🛠️ Tech Stack
- **Framework:** [Electron.js](https://www.electronjs.org/) v32.2.7 (Desktop App)
- **Frontend:** HTML5, CSS3 (Responsive Design), Vanilla JavaScript
- **Backend/Database:** [Google Firebase Firestore](https://firebase.google.com/)
- **WhatsApp Integration:** [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) (WhatsApp Web API)
- **AI Engine:** Google Gemini API (for WhatsApp auto-reply)
- **PDF Engine:** html2pdf.js

## 📦 Installation

### For Users
1. Download `ClassCore Setup 2.0.0.exe` from the [Releases](https://github.com/prajapatikuldeep455-source/classcore-tuition/releases) page.
2. Run the installer and follow the on-screen instructions.

### For Developers
1. Clone the repository:
   ```bash
   git clone https://github.com/prajapatikuldeep455-source/classcore-tuition.git
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the app in development mode:
   ```bash
   npm start
   ```

## 🔐 Security & Privacy
- **Secure Authentication:** All passwords are encrypted using SHA-256 hashing.
- **Role-Based Access:** Separate permissions for Administrators and Employees.
- **Data Privacy:** Local-first data storage. WhatsApp session data is stored locally on your machine only.

---

© 2025 ClassCore Tuition Management
