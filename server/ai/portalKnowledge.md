# Medresa Exam Portal Knowledge Base

This document serves as the authoritative, maintained source of truth for the Medresa Exam Portal AI Assistant. All answers provided by the assistant must be grounded strictly in the facts below.

---

## 1. System Overview & Purpose
- **System Name**: Medresa Exam Portal (የመድረሳ የፈተና ፖርታል).
- **Technology Stack**: Modern MERN stack (React 19, Vite, Tailwind CSS v4, Express, Mongoose, react-i18next).
- **Core Purpose**: A secure, modern, bilingual (English and Amharic) exam creation, administration, and grading platform designed specifically for Medresa classes and Islamic studies.
- **Languages & Themes**: Full support for English and Amharic (አማርኛ) with dynamic text direction (`dir="auto"`) and typography (Noto Sans, Noto Naskh Arabic, Noto Sans Ethiopic). Light and Dark themes supported across all pages.

---

## 2. Admin Navigation & Main Sections

### A. Admin Dashboard (`/admin/dashboard` or `/admin`)
- Displays real-time portal statistics:
  - **Total Students** & active student count.
  - **Total Exams** & active open exams.
  - **Total Submissions** across all exams.
  - **Pending Manual Grading** count for short-answer questions.
  - **Average Class Score** (%) & overall participation rate.
- Quick action buttons to Create Exam, Add Student, View Results, or compose email announcements.
- Live feed of recent student attempt submissions.

### B. Student Management (`/admin/students`)
- **Adding Individual Students**:
  - Click `+ Add Student`.
  - Enter Full Name, Student ID (optional custom ID or auto-generated like `STU-1001`), Email (optional), Gender (Male/Female), Category (Department/Level), and Password.
- **Excel / Text Bulk Import**:
  - Upload a `.xlsx`, `.csv`, or formatted text file containing columns: `studentId`, `fullName`, `gender`, `categoryId`.
- **Student Profile Drawer**:
  - View individual student attempt history, total exams completed, pass/fail record, average score, and print/copy credentials.
- **Direct Email Announcements**:
  - Compose emails with PDF, Word, or Image attachments directly to selected students or entire classes.

### C. Exam Management (`/admin/exams`)
- **Creating & Editing Exams (`/admin/exams/new` or `/admin/exams/:id`)**:
  - Set Exam Title, Category, Description/Instructions, Duration (in minutes), Pass Mark (%), Start Window, End Window, Results Visibility (`hidden`, `immediate`, `after_release`), and Close Action (`block_new` or `force_submit`).
  - Quick `5+` button: Ustaz can add +5 minutes to an exam duration anytime (including while students are taking the exam live).
  - Shuffling Options: Shuffle questions order and shuffle option choices per student.
  - Allowed Students: Restrict exam access to specific students or leave blank to allow all active students.
- **Exam Statuses**:
  - `draft`: Only visible to Ustaz, not accessible to students.
  - `open`: Active and accepting student attempts.
  - `closed`: Terminated. Blocks new attempts, optionally auto-submits in-progress attempts if set to `force_submit`.
- **Exam Actions**:
  - Duplicate Exam (creates a copy with all questions).
  - Download as Word Document (`.docx`).
  - Copy public exam entrance link (`/exam/:token`).

### D. Question Types & Importer
- **Supported Question Types**:
  1. `mcq_single`: Multiple Choice (Single Answer).
  2. `mcq_multi`: Multiple Choice (Multiple Answers / Select All That Apply).
  3. `true_false`: True or False.
  4. `short_answer`: Short Answer / Essay (requires Ustaz manual grading).
- **Bulk Question Importer**:
  - Paste unformatted text or Word content with an asterisk (`*`) right after the correct option text (e.g., `A) Option Text *`).
  - Short answer questions can be pasted directly without options.

### E. Category Management (`/admin/categories`)
- Organize students and exams into academic levels or departments (e.g., Tajweed, Fiqh, Hadith, Seerah, Quran Hifz).

### F. Results & Manual Grading (`/admin/results`)
- **Automated Grading**: Multiple choice and True/False questions are graded automatically upon submission.
- **Teacher Manual Grading (Short Answers)**:
  - Open attempt details from Results view.
  - Ustaz can inspect student written responses, award points from 0 to max question marks, and write teacher feedback.
- **Reset Student Attempt**:
  - Reset an attempt to allow a student to re-enter and retake an exam.
- **Export to Excel**:
  - Export complete class grade sheets with breakdown per exam to `.xlsx`.

---

## 3. Student Exam Experience (`/exam/:token` or `/exam`)

- **Student Login / Entrance**:
  - Students enter using the unique Exam Token URL (`/exam/:token`) or by logging in with their Student ID & Password.
- **Live Exam Environment**:
  - **Live Countdown Timer**: Displays remaining time with visual color indicators (green -> amber -> pulsing red $\le 3$ minutes).
  - **3-Minute Alert**: Modal popup and banner warning when remaining time is $\le 3$ minutes.
  - **Ustaz Live Time Extension**: If Ustaz clicks `5+`, the student timer automatically increases live by +5 minutes with an alert toast.
  - **Autosave**: Progress auto-saves every few seconds to prevent data loss.
  - **Question Navigator**: Drawer/sheet allowing quick jumping between answered, unanswered, and flagged questions.
  - **Anti-Cheat Monitoring**: Tracks tab switches; shows warning modal if tab switching exceeds allowed limits.

---

## 4. Key Rules for the AI Assistant
1. Only answer questions related to using, managing, and navigating the Medresa Exam Portal.
2. For out-of-scope questions (e.g., recipes, general coding, world history, weather), decline politely in the user's language and state your scope.
3. Respond in the exact language used by the user (Amharic -> Amharic, English -> English, Arabic -> Arabic).
4. Maintain accuracy according to the feature definitions above.
