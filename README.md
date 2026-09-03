# ClassCore — Tuition Management System

![Version](https://img.shields.io/badge/version-1.7.3-orange)
![Platform](https://img.shields.io/badge/platform-Windows-blue)
![License](https://img.shields.io/badge/license-Proprietary-lightgrey)

**ClassCore** is a professional, high-performance desktop application designed for tuition center administrators to streamline their daily operations. From student enrollment and fee tracking to academic performance and financial management, ClassCore provides a centralized hub for educational administration.

## ? Key Features

### ?? Student & Batch Management
- **Complete Student Lifecycle:** Easy enrollment, editing, and tracking of student data.
- **Dynamic Batching:** Create and manage multiple batches with custom timings, subjects, and capacity limits.
- **Student Assignment:** Quickly assign students to batches with a one-click interface.

### ?? Financial Suite
- **Fee Management:** Support for monthly and annual fee structures with individual student overrides.
- **Bulk Collection:** Rapidly collect fees for entire classes or batches with a single click.
- **Expense Tracking:** Record operational costs and get real-time insights into net profit and loss.

### ?? Academic Tracking
- **Exam Management:** Schedule exams and record marks for entire classes.
- **Performance Analytics:** Automatic calculation of averages and percentages per exam.
- **Professional Report Cards:** Generate and export detailed student performance reports as high-quality PDFs.

### ? Operational Tools
- **Real-time Attendance:** Fast, toggle-based attendance marking with daily and batch-wise filters.
- **Parent Communication:** Integrated WhatsApp broadcast system to send announcements to parents instantly.
- **ID Card Generation:** Create and print professional student identity cards.

## ??? Tech Stack
- **Framework:** [Electron.js](https://www.electronjs.org/) (Desktop App)
- **Frontend:** HTML5, CSS3 (Responsive Design), Vanilla JavaScript
- **Backend/Database:** [Google Firebase Firestore](https://firebase.google.com/) (for trial prevention and data synchronization)
- **PDF Engine:** html2pdf.js

## ?? Installation

### For Users
1. Navigate to the `releases` folder in this repository.
2. Download `ClassCore Setup 1.7.3.exe`.
3. Run the installer and follow the on-screen instructions.

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

## ?? Security & Privacy
- **Secure Authentication:** All passwords are encrypted using SHA-256 hashing.
- **Role-Based Access:** Separate permissions for Administrators and Employees.
- **Data Privacy:** Local-first data storage with optional cloud synchronization.

---
**Developed by Kuldeep Prajapati**  
© 2025 ClassCore Tuition Management
