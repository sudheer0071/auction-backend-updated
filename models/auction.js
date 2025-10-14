import mongoose from "mongoose";

const auctionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  auctionId: { type: String },

  // Event-based fields (normalized structure - follows Event model pattern)
  event_id: { type: mongoose.Schema.Types.ObjectId, ref: "Event" },
  
  // Basic auction fields
  description: { type: String },
  category: { type: String },
  brief_text: { type: String },
  
  // Auction configuration
  default_currency: { type: String, default: "GBP" },
  multi_currency: { type: Boolean, default: false },
  
  // Include options
  include_auction: { type: Boolean, default: true },
  include_questionnaire: { type: Boolean, default: false },
  include_rfq: { type: Boolean, default: false },
  seal_results: { type: Boolean, default: true },
  
  // Legacy fields (for backward compatibility - will be deprecated)
  lots: [{ type: mongoose.Schema.Types.ObjectId, ref: "Lot" }],
  documents: [{ type: String }], // file paths or URLs
  invitedSuppliers: [{
    type: mongoose.Schema.Types.Mixed,
    validate: {
      validator: function(v) {
        // Allow ObjectId (existing users) or email string (non-existing suppliers)
        return mongoose.Types.ObjectId.isValid(v) || 
               (typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
      },
      message: 'Invited supplier must be either a valid ObjectId or email address'
    }
  }],
  invitedSupplierEmail: [{
    type: String,
    validate: {
      validator: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      message: 'Must be a valid email address'
    }
  }],
  sapCodes: [{ type: String }],
  reservePrice: { type: Number },
  currency: { type: String },
  startTime: { type: Date },
  endTime: { type: Date },
  autoExtension: { type: Boolean, default: false },
  extensionMinutes: { type: Number, default: 5 },
  
  // NORMALIZED STRUCTURE (follows Event model pattern)
  // Reference to separate collections instead of embedded documents
  auction_settings: { type: mongoose.Schema.Types.ObjectId, ref: "AuctionSettings" },
  questionnaires: [{ type: mongoose.Schema.Types.ObjectId, ref: "Questionnaire" }],
  event_documents: [{ type: mongoose.Schema.Types.ObjectId, ref: "EventDocument" }],
  event_lots: [{ type: mongoose.Schema.Types.ObjectId, ref: "EventLot" }],
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "EventParticipant" }],
  
  // Auto accept participants
  auto_accept: { type: Boolean, default: false },

  // Announcements
  announcements: [{
    message: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  }],

  status: { type: String, enum: ["draft", "published", "Scheduled", "Active", "Paused", "Ended"], default: "draft" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  previewEmail: { type: String },
  
  // Cost parameters for advanced pricing calculations
  costParams: {
    priceWeight: { type: Number, default: 1 },
    fobWeight: { type: Number, default: 0 },
    taxWeight: { type: Number, default: 0 },
    dutyWeight: { type: Number, default: 0 },
    performanceWeight: { type: Number, default: 0 },
    qualityRequirements: String,
  },
}, { timestamps: true });

export default mongoose.model("Auction", auctionSchema);