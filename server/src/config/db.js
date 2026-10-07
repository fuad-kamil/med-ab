import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDB() {
  try {
    const isProd = env.NODE_ENV === 'production';
    await mongoose.connect(env.MONGODB_URI, {
      maxPoolSize: 20,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      autoIndex: !isProd,
    });
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    if (err.name === 'MongoServerSelectionError' || err.message.includes('timed out')) {
      console.error(
        '\n💡 TIP: If using MongoDB Atlas, make sure your current IP address is whitelisted in MongoDB Atlas -> Network Access (Add 0.0.0.0/0 or Current IP).\n'
      );
    }
    process.exit(1);
  }

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err.message);
  });
}
