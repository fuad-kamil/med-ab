import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Exam } from '../models/Exam.js';
import { Question } from '../models/Question.js';
import { Attempt } from '../models/Attempt.js';
import { Category } from '../models/Category.js';
import { ExamSnapshot } from '../models/ExamSnapshot.js';

async function syncAllIndexes() {
  await connectDB();
  console.log('Syncing indexes across all Mongoose models...');

  await Promise.all([
    User.syncIndexes(),
    Exam.syncIndexes(),
    Question.syncIndexes(),
    Attempt.syncIndexes(),
    Category.syncIndexes(),
    ExamSnapshot.syncIndexes(),
  ]);

  console.log('✅ All indexes synced successfully!');
  await mongoose.disconnect();
}

syncAllIndexes().catch((err) => {
  console.error('Failed to sync indexes:', err);
  process.exit(1);
});
