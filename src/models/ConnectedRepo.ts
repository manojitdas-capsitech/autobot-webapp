import mongoose from 'mongoose';

const connectedRepoSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  owner: { type: String, required: true },
  repo: { type: String, required: true },
  fullName: { type: String, required: true, unique: true },
  webhookId: { type: Number, required: true },
});

export const ConnectedRepo = mongoose.model('ConnectedRepo', connectedRepoSchema);
