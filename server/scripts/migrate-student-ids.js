import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { User } from '../src/models/User.js';
import { Counter, formatStudentId } from '../src/models/Counter.js';

dotenv.config();

const isDryRun = process.argv.includes('--dry-run');

export async function runMigration({ dryRun = isDryRun, silent = false } = {}) {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/exam-portal';

  if (!silent) {
    console.log(`\n==================================================`);
    console.log(` Medresa Exam Portal — Student ID Migration Tool`);
    console.log(`==================================================`);
    if (dryRun) {
      console.log(`[DRY RUN MODE] No changes will be written to MongoDB.\n`);
    } else {
      console.log(`⚠️ IMPORTANT REMINDER: Please make sure you have created a backup of your database!`);
      console.log(`   You can create a backup anytime by running: node server/scripts/backup-db.js\n`);
    }
  }

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(mongoUri);
  }

  try {
    // 1. Fetch only students, sorted by createdAt asc, _id asc
    const students = await User.find({ role: 'student' }).sort({ createdAt: 1, _id: 1 });

    if (students.length === 0) {
      if (!silent) console.log(`No student accounts found. Exiting.`);
      return { migratedCount: 0, status: 'no_students' };
    }

    // 2. Idempotency Check: Check if all students already match STU-01, STU-02... in order
    let alreadyMigrated = true;
    for (let i = 0; i < students.length; i++) {
      const expectedId = formatStudentId(i + 1);
      if (students[i].studentId !== expectedId) {
        alreadyMigrated = false;
        break;
      }
    }

    const counterDoc = await Counter.findById('studentId');
    if (alreadyMigrated && counterDoc && counterDoc.seq >= students.length) {
      if (!silent) console.log(`✅ No migration needed. All ${students.length} student IDs are already canonical and up to date.`);
      return { migratedCount: 0, status: 'already_migrated' };
    }

    // 3. Build mapping table (Old ID -> New ID)
    const mapping = students.map((student, idx) => {
      const newId = formatStudentId(idx + 1);
      return {
        id: student._id.toString(),
        fullName: student.fullName,
        oldStudentId: student.studentId || 'N/A',
        newStudentId: newId,
        createdAt: student.createdAt,
      };
    });

    if (!silent) {
      console.log(`Found ${students.length} student account(s) to process:\n`);
      console.log(`| #  | Full Name            | Old Student ID | New Student ID |`);
      console.log(`|----|----------------------|----------------|----------------|`);
      mapping.forEach((m, idx) => {
        const num = String(idx + 1).padEnd(2, ' ');
        const name = m.fullName.padEnd(20, ' ').slice(0, 20);
        const oldId = m.oldStudentId.padEnd(14, ' ');
        const newId = m.newStudentId.padEnd(14, ' ');
        console.log(`| ${num} | ${name} | ${oldId} | ${newId} |`);
      });
      console.log(``);
    }

    if (dryRun) {
      if (!silent) console.log(`[DRY RUN COMPLETE] Target next counter sequence will be: ${students.length + 1}`);
      return { migratedCount: students.length, status: 'dry_run', mapping };
    }

    // 4. Two-Pass Database Update to avoid unique index collisions
    if (!silent) console.log(`Starting Two-Pass Migration...`);

    // Pass 1: Assign temporary unique string TMP-<id> to each student
    for (const student of students) {
      await User.findByIdAndUpdate(student._id, { studentId: `TMP-${student._id}` });
    }

    // Pass 2: Assign final STU-01, STU-02... IDs
    for (const m of mapping) {
      await User.findByIdAndUpdate(m.id, { studentId: m.newStudentId });
    }

    // 5. Update Counter collection seq to total students count
    await Counter.findOneAndUpdate(
      { _id: 'studentId' },
      { seq: students.length },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 6. Write CSV mapping file for the Ustaz
    const csvLines = ['Full Name,Old Student ID,New Student ID'];
    mapping.forEach((m) => {
      csvLines.push(`"${m.fullName.replace(/"/g, '""')}","${m.oldStudentId}","${m.newStudentId}"`);
    });

    const csvPath = path.join(process.cwd(), 'migration-student-ids.csv');
    fs.writeFileSync(csvPath, csvLines.join('\n'));

    if (!silent) {
      console.log(`\n✅ Migration successfully completed!`);
      console.log(`- Updated ${students.length} student account(s).`);
      console.log(`- Next auto-generated student ID will be: ${formatStudentId(students.length + 1)}.`);
      console.log(`- Saved mapping CSV to: ${csvPath}`);
      console.log(`- Note: Attempt records reference student ObjectId (_id) and remain intact.`);
    }

    return { migratedCount: students.length, status: 'success', mapping };
  } catch (err) {
    if (!silent) console.error(`❌ Migration failed: ${err.message}`);
    throw err;
  } finally {
    if (mongoose.connection.readyState === 1 && !silent) {
      await mongoose.disconnect();
    }
  }
}

// Execute if run directly from command line
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('migrate-student-ids.js')) {
  runMigration().catch(() => process.exit(1));
}
