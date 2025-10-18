import mongoose from "mongoose";

const participantSchema = new mongoose.Schema({
  email: { type: String, required: true },
  name: { type: String },
  company: { type: String },
}, { timestamps: true });

const eventParticipantSchema = new mongoose.Schema({
  event_id: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
  participant: participantSchema,
  status: { type: String, enum: ["pending", "yes","not_accepted"], default: "pending" },
  auctionStatus: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
  approved: { type: Boolean, default: false },
  questionnaires_completed: { type: Boolean, default: false },
  lots_entered: { type: Boolean, default: false },
  invited_at: { type: Date, default: Date.now },
}, { timestamps: true });

export default mongoose.model("EventParticipant", eventParticipantSchema);
