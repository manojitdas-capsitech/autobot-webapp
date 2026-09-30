import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  githubId: { type: Number, required: true, unique: true },
  login: { type: String, required: true },
  name: { type: String, default: '' },
  avatarUrl: { type: String, default: '' },
  accessTokenEnc: { type: String, required: true, select: false },
});

export const User = mongoose.model('User', userSchema);
