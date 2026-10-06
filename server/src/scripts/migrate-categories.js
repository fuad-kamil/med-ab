import 'dotenv/config';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Category } from '../models/Category.js';
import { User } from '../models/User.js';
import { Exam } from '../models/Exam.js';

async function migrate() {
  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // 1. Create "General" category if it doesn't exist
    let generalCategory = await Category.findOne({ name: 'General' });
    if (!generalCategory) {
      generalCategory = await Category.create({
        name: 'General',
        description: 'Default category for all students and exams',
      });
      console.log('Created "General" category');
    } else {
      console.log('"General" category already exists');
    }

    // 2. Assign all students without categories to "General"
    const studentsWithoutCategory = await User.countDocuments({
      role: 'student',
      $or: [
        { categoryIds: { $exists: false } },
        { categoryIds: { $size: 0 } },
      ],
    });

    if (studentsWithoutCategory > 0) {
      const result = await User.updateMany(
        {
          role: 'student',
          $or: [
            { categoryIds: { $exists: false } },
            { categoryIds: { $size: 0 } },
          ],
        },
        { $set: { categoryIds: [generalCategory._id] } }
      );
      console.log(`Assigned ${result.modifiedCount} students to "General" category`);
    } else {
      console.log('All students already have categories');
    }

    // 3. Assign all exams without a category to "General"
    const examsWithoutCategory = await Exam.countDocuments({
      $or: [
        { categoryId: { $exists: false } },
        { categoryId: null },
      ],
    });

    if (examsWithoutCategory > 0) {
      const result = await Exam.updateMany(
        {
          $or: [
            { categoryId: { $exists: false } },
            { categoryId: null },
          ],
        },
        { $set: { categoryId: generalCategory._id } }
      );
      console.log(`Assigned ${result.modifiedCount} exams to "General" category`);
    } else {
      console.log('All exams already have categories');
    }

    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

migrate();
