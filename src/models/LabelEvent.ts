import mongoose from 'mongoose';

const labelEventSchema = new mongoose.Schema({
  type: { type: String, enum: ['Issue', 'PR'], required: true },
  number: { type: Number, required: true },
  repo: { type: String, required: true },
  labels: { type: [String], default: [] },
  time: { type: Date, default: Date.now },
});

export const LabelEvent = mongoose.model('LabelEvent', labelEventSchema);
