import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Exam } from '../models/Exam.js';
import { Attempt } from '../models/Attempt.js';
import { Question } from '../models/Question.js';
import { Category } from '../models/Category.js';
import { ExamSnapshot } from '../models/ExamSnapshot.js';
import { getOrCreateExamSnapshot } from '../services/snapshotService.js';

dotenv.config();

const isDryRun = process.argv.includes('--dry-run');

async function runMigration() {
  console.log('====================================================');
  console.log('📦 EXAM PORTAL - EXAM SNAPSHOT MIGRATION SCRIPT');
  console.log('====================================================');
  console.log('📌 NOTE: Atlas Free Tier does not offer automated backups.');
  console.log('   Please make sure to export/backup your database before running on production!\n');

  if (isDryRun) {
    console.log('🔍 RUNNING IN DRY RUN MODE (No database changes will be saved)\n');
  }

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/exam-portal';
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB:', mongoUri.split('@').pop() || mongoUri);

  const exams = await Exam.find().populate('categoryId', 'name').lean();
  console.log(`Found ${exams.length} exams in database.`);

  let snapshotsCreated = 0;
  let attemptsUpdated = 0;

  for (const exam of exams) {
    const attemptCount = await Attempt.countDocuments({ examId: exam._id });

    // Find existing snapshot
    let snapshot = await ExamSnapshot.findOne({ examId: exam._id, deletedAt: null });

    if (!snapshot) {
      const questions = await Question.find({ examId: exam._id }).sort({ order: 1 }).lean();
      const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);
      const categoryName = exam.categoryId?.name || 'Uncategorized';

      const formattedQuestions = questions.map((q) => ({
        _id: q._id,
        type: q.type,
        text: q.text,
        options: (q.options || []).map((opt) => ({ id: opt.id, text: opt.text })),
        correctAnswer: q.correctAnswer,
        marks: q.marks || 1,
        explanation: q.explanation || '',
        order: q.order || 0,
      }));

      console.log(`[Exam: "${exam.title}"] Creating snapshot (${attemptCount} existing attempts)...`);

      if (!isDryRun) {
        snapshot = await ExamSnapshot.create({
          examId: exam._id,
          title: exam.title,
          description: exam.description || '',
          subject: exam.subject || '',
          categoryId: exam.categoryId?._id || exam.categoryId || null,
          categoryName,
          durationMinutes: exam.durationMinutes || 30,
          passMark: exam.passMark ?? exam.passingMark ?? 50,
          totalMarks,
          resultsVisibility: exam.resultsVisibility || 'hidden',
          questions: formattedQuestions,
        });
      }
      snapshotsCreated++;
    } else {
      console.log(`[Exam: "${exam.title}"] Snapshot already exists.`);
    }

    // Update unlinked attempts for this exam
    const unlinkedAttempts = await Attempt.find({
      examId: exam._id,
      $or: [{ snapshotId: null }, { examTitle: '' }],
    });

    if (unlinkedAttempts.length > 0) {
      console.log(`   Linking ${unlinkedAttempts.length} attempts for "${exam.title}"...`);
      if (!isDryRun && snapshot) {
        for (const att of unlinkedAttempts) {
          att.snapshotId = snapshot._id;
          att.examTitle = snapshot.title;
          att.categoryName = snapshot.categoryName;
          att.passMark = snapshot.passMark;
          if (!att.totalMarks) {
            att.totalMarks = snapshot.totalMarks;
          }
          await att.save();
          attemptsUpdated++;
        }
      } else if (isDryRun) {
        attemptsUpdated += unlinkedAttempts.length;
      }
    }
  }

  console.log('\n====================================================');
  console.log(`🎉 MIGRATION COMPLETE (${isDryRun ? 'DRY RUN' : 'EXECUTED'})`);
  console.log(`   Snapshots created: ${snapshotsCreated}`);
  console.log(`   Attempts updated:   ${attemptsUpdated}`);
  console.log('====================================================');

  await mongoose.disconnect();
}

runMigration().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
