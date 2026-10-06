import 'dotenv/config';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { User } from '../models/User.js';

async function seed() {
  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existing = await User.findOne({ role: 'admin' });
    if (existing) {
      console.log('Admin account already exists:');
      console.log(`   Name: ${existing.fullName}`);
      console.log('   Skipping seed. Delete the admin document to re-seed.');
      process.exit(0);
    }

    const passwordHash = await User.hashPassword(env.ADMIN_PASSWORD);
    const admin = await User.create({
      role: 'admin',
      fullName: env.ADMIN_FULLNAME,
      passwordHash,
      studentId: null,
    });

    console.log('Admin account created successfully!');
    console.log(`   Name:     ${admin.fullName}`);
    console.log(`   Password: ${env.ADMIN_PASSWORD}`);
    console.log('');
    console.log('Change this password after first login!');
  } catch (err) {
    console.error('Seed failed:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
