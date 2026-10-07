import 'dotenv/config';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Category } from '../models/Category.js';
import { Exam } from '../models/Exam.js';
import { Question } from '../models/Question.js';
import { Attempt } from '../models/Attempt.js';

async function seedDemo() {
  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log('Connected to MongoDB for seed:demo');

    // 1. Clear test demo data (preserving non-demo data if needed, or resetting demo collections)
    await User.deleteMany({ studentId: { $regex: /^STU-DEMO/ } });
    await Category.deleteMany({ name: { $regex: /Demo Category/ } });
    await Exam.deleteMany({ title: { $regex: /Demo Exam/ } });

    // Ensure Admin
    let admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      const passwordHash = await User.hashPassword(env.ADMIN_PASSWORD || 'admin123');
      admin = await User.create({
        role: 'admin',
        fullName: env.ADMIN_FULLNAME || 'System Admin',
        passwordHash,
        studentId: null,
      });
    }

    // 2. Create Categories
    const catFiqh = await Category.create({ name: 'Demo Category: Fiqh' });
    const catHadith = await Category.create({ name: 'Demo Category: Hadith' });

    // 3. Create Students
    const student1 = await User.create({
      role: 'student',
      fullName: 'Aisha Ahmed',
      studentId: 'STU-DEMO-001',
      gender: 'female',
      email: 'aisha@example.com',
      isActive: true,
    });

    const student2 = await User.create({
      role: 'student',
      fullName: 'Bilal Mohammed',
      studentId: 'STU-DEMO-002',
      gender: 'male',
      email: '', // No email
      isActive: true,
    });

    const student3 = await User.create({
      role: 'student',
      fullName: 'Fatima Omar',
      studentId: 'STU-DEMO-003',
      gender: 'female',
      email: 'fatima@example.com',
      isActive: false,
    });

    // 4. Create Questions
    const q1 = await Question.create({
      type: 'single',
      text: 'What is the first pillar of Islam?',
      options: ['Shahada', 'Salah', 'Zakat', 'Sawm'],
      correctAnswer: 'Shahada',
      marks: 5,
    });

    const q2 = await Question.create({
      type: 'text',
      text: 'Explain the importance of Niyyah (intention).',
      options: [],
      correctAnswer: '',
      marks: 10,
    });

    // 5. Create Exams (Open, Closed, Draft, Deleted)
    const examOpen = await Exam.create({
      title: 'Demo Exam: Fiqh Midterm (Open)',
      categoryId: catFiqh._id,
      durationMinutes: 30,
      passMark: 70,
      status: 'open',
      accessToken: 'demo-open-123',
      questions: [q1._id, q2._id],
      totalMarks: 15,
      isDeleted: false,
    });

    const examClosed = await Exam.create({
      title: 'Demo Exam: Hadith Final (Closed)',
      categoryId: catHadith._id,
      durationMinutes: 45,
      passMark: 60,
      status: 'closed',
      accessToken: 'demo-closed-456',
      questions: [q1._id],
      totalMarks: 5,
      isDeleted: false,
    });

    // 6. Create Attempts in every state
    // State A: Graded (Passed) & Emailed
    await Attempt.create({
      examId: examOpen._id,
      studentId: student1._id,
      startedAt: new Date(Date.now() - 3600000),
      deadline: new Date(Date.now() - 1800000),
      submittedAt: new Date(Date.now() - 2000000),
      status: 'submitted',
      score: 15,
      totalMarks: 15,
      passMark: 70,
      needsGrading: false,
      resultEmail: {
        status: 'sent',
        sentCount: 1,
        lastSentAt: new Date(),
        sentToMasked: 'ai***@example.com',
      },
    });

    // State B: Needs Review (Text question un-graded) & No email
    await Attempt.create({
      examId: examOpen._id,
      studentId: student2._id,
      startedAt: new Date(Date.now() - 1800000),
      deadline: new Date(Date.now() - 600000),
      submittedAt: new Date(Date.now() - 700000),
      status: 'submitted',
      score: 5,
      totalMarks: 15,
      passMark: 70,
      needsGrading: true,
      resultEmail: { status: 'none' },
    });

    // State C: In Progress
    await Attempt.create({
      examId: examOpen._id,
      studentId: student3._id,
      startedAt: new Date(),
      deadline: new Date(Date.now() + 1800000),
      status: 'in_progress',
      resultEmail: { status: 'none' },
    });

    console.log('Seed demo data created successfully!');
    console.log(`- Created 3 students (Aisha, Bilal, Fatima)`);
    console.log(`- Created 2 exams (Fiqh Midterm [Open], Hadith Final [Closed])`);
    console.log(`- Created 3 attempts (Graded & Emailed, Needs Review, In Progress)`);
  } catch (err) {
    console.error('Seed demo failed:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedDemo();
