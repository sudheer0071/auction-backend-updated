import mongoose from "mongoose";

const eventSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  default_currency: { type: String, required: true, default: "GBP" },
  multi_currency: { type: Boolean, default: false },
  brief_text: { type: String },
  include_auction: { type: Boolean, default: false },
  include_questionnaire: { type: Boolean, default: false },
  include_rfq: { type: Boolean, default: false },
  seal_results: { type: Boolean, default: true },
  status: { type: String, enum: ["draft", "published"], default: "draft" },
  
  // Reference to related data
  auction_settings: { type: mongoose.Schema.Types.ObjectId, ref: "AuctionSettings" },
  questionnaires: [{ type: mongoose.Schema.Types.ObjectId, ref: "Questionnaire" }],
  documents: [{ type: mongoose.Schema.Types.ObjectId, ref: "EventDocument" }],
  lots: [{ type: mongoose.Schema.Types.ObjectId, ref: "EventLot" }],
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "EventParticipant" }],
  
  // Auto accept participants
  auto_accept: { type: Boolean, default: false },

  // Announcements
  announcements: [{
    message: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  }],

  // User who created the event
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

export default mongoose.model("Event", eventSchema);
