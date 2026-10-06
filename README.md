# Medresa Exam Portal (MERN)

A secure, responsive online examination platform built for Medresas using **React + Vite + TailwindCSS** (Frontend) and **Express + Node.js + Mongoose** (Backend). Supports English & Amharic localization (`react-i18next`), light/dark themes, strict anti-cheating controls, auto-generated student IDs, and clean URL token management.

---

## 🌟 Key Features

1. **Auto-Generated Sequential Student IDs (`STU-01`, `STU-02`, ...)**:
   - Student IDs are automatically generated in sequence (`STU-01`, `STU-02`, ... `STU-99`, `STU-100`, ...).
   - Generated using atomic counter operations (`Counter` collection) to prevent race conditions and duplicate IDs.
   - IDs are immutable after creation and are never reused (even if a student is deleted).
   - Student login lookup features forgiving normalization: `"stu-1"`, `"STU1"`, `"stu01"`, and `"stu 01"` all resolve to `STU-01`.

2. **Clean Exam Address Bar & Token Protection**:
   - Access tokens in shared exam links (`/exam/:token`) are immediately read, stored securely in `sessionStorage`, and cleaned from the browser address bar (`/exam`).
   - All subsequent pages (`/exam`, `/exam/take`, `/exam/result`) use clean URLs.
   - `Referrer-Policy: no-referrer` header and meta tag prevent leaking tokens in HTTP Referrer headers.
   - If an exam link is missing or invalid, a friendly translated message is displayed.

3. **Global Theme & Language Preferences**:
   - Language switcher (English / አማርኛ) and Theme toggle (Light / Dark) accessible on Ustaz login, Exam portal entrance, and active exam headers.
   - Persisted in `localStorage` and applied before first render to prevent FOUC.
   - Switching language or theme during an active exam does NOT reset timer, student answers, or scroll position.

---

## 🚀 Running the Project

### Server (Backend)
```bash
cd server
npm install
npm run dev
```

### Client (Frontend)
```bash
cd client
npm install
npm run dev
```

---

## 📦 Student ID Database Migration Script

If you have existing student records created before auto-generated IDs:

### Step 1: Create a Database Backup
Before running migrations on production/Atlas databases, create a backup:
```bash
node server/scripts/backup-db.js
```
This dumps all student accounts, exams, and attempt records into a timestamped JSON file in `server/backups/`.

### Step 2: Dry Run Migration (Preview Changes)
To preview the mapping table without writing to MongoDB:
```bash
node server/scripts/migrate-student-ids.js --dry-run
```

### Step 3: Run the Migration
To execute the migration and assign canonical `STU-01`, `STU-02`, ... IDs:
```bash
node server/scripts/migrate-student-ids.js
```
- Performs a two-pass update to avoid unique index collisions.
- Sets the persistent `Counter` sequence so newly created students continue seamlessly.
- Generates a mapping CSV file (`migration-student-ids.csv`) for Ustaz reference.
- Idempotent: running the script multiple times is safe.

---

## 🧪 Testing

Run backend unit tests (including student ID formatting, block reservation, normalization, and bulk import tests):
```bash
cd server
npm test
```
# med-ab
