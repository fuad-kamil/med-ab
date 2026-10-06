import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { User } from '../src/models/User.js';
import { Attempt } from '../src/models/Attempt.js';
import { Exam } from '../src/models/Exam.js';

dotenv.config();

async function runBackup() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/exam-portal';
  console.log(`Connecting to MongoDB for backup: ${mongoUri}...`);
  await mongoose.connect(mongoUri);

  try {
    const students = await User.find({ role: 'student' }).lean();
    const attempts = await Attempt.find({}).lean();
    const exams = await Exam.find({}).lean();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupFile = path.join(backupDir, `backup-database-${timestamp}.json`);
    const backupData = {
      timestamp: new Date().toISOString(),
      counts: {
        students: students.length,
        attempts: attempts.length,
        exams: exams.length,
      },
      students,
      attempts,
      exams,
    };

    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    console.log(`✅ Backup created successfully!`);
    console.log(`Path: ${backupFile}`);
    console.log(`Students: ${students.length}, Attempts: ${attempts.length}, Exams: ${exams.length}`);
  } catch (err) {
    console.error(`❌ Backup failed: ${err.message}`);
  } finally {
    await mongoose.disconnect();
  }
}

runBackup();
