import mongoose from 'mongoose';
import './loadEnv';
import { publicError } from '../publicError';

export async function connectDB() {
  try {
    const url = process.env.MONGO_DB_URL;
    if (!url) {
      throw new Error('MONGO_DB_URL is missing. Set it in .env or .env.docker.');
    }
    await mongoose.connect(url);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', publicError(error));
    process.exit(1);
  }
}
