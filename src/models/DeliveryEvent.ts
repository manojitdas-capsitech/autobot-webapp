import mongoose from 'mongoose';

const actionSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['github_label', 'slack'], required: true },
    status: { type: String, enum: ['pending', 'success', 'failed', 'skipped'], required: true },
    detail: { type: String, default: '' },
    attempts: { type: Number, default: 0 },
  },
  { _id: false },
);

const deliveryEventSchema = new mongoose.Schema({
  deliveryId: { type: String, required: true, unique: true },
  eventType: { type: String, required: true },
  githubAction: { type: String, default: '' },
  owner: { type: String, required: true },
  repo: { type: String, required: true },
  fullName: { type: String, required: true },
  number: { type: Number },
  title: { type: String, default: '' },
  labelsToApply: { type: [String], default: [] },
  actions: { type: [actionSchema], default: [] },
  receivedAt: { type: Date, default: Date.now },
});

deliveryEventSchema.index({ fullName: 1, receivedAt: -1 });

export const DeliveryEvent = mongoose.model('DeliveryEvent', deliveryEventSchema);
