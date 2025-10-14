import mongoose from "mongoose";

const auctionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  auctionId: { type: String },

  // Event-based fields (new structure)
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
  
  // Legacy fields (for backward compatibility)
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
  
  // Auction settings (new structure, inline for backward compatibility)
  auction_settings: {
    start_date: { type: Date },
    start_time: { type: String, default: "09:00" },
    bid_direction: { type: String, enum: ["forward", "reverse"], default: "reverse" },
    event_type: { type: String, enum: ["ranked", "sealed"], default: "ranked" },
    minimum_duration: { type: Number, default: 10 },
    dynamic_close_period: { type: String, default: "none" },
    minimum_bid_change: { type: Number, default: 0.50 },
    maximum_bid_change: { type: Number, default: 10.00 },
    tied_bid_option: { type: String, default: "equal_worst_position" }
  },
  
  // Questionnaires (new structure)
  questionnaires: [{
    name: { type: String },
    deadline: { type: Date },
    pre_qualification: { type: Boolean, default: false },
    scoring: { type: Boolean, default: false },
    weighting: { type: Number, default: 0 },
    order_index: { type: Number, default: 0 }
  }],
  
  // Event documents (new structure)
  event_documents: [{
    name: { type: String },
    file_path: { type: String },
    file_size: { type: Number },
    mime_type: { type: String },
    version: { type: Number, default: 1 },
    shared_with_all: { type: Boolean, default: false }
  }],
  
  // Event lots (new structure for RFQ)
  event_lots: [{
    name: { type: String },
    quantity: { type: Number },
    unit_of_measure: { type: String },
    current_price: { type: Number },
    qualification_price: { type: Number },
    current_value: { type: Number },
    qualification_value: { type: Number }
  }],
  
  // Event participants (new structure)
  participants: [{
    participant: {
      email: { type: String },
      name: { type: String },
      company: { type: String }
    },
    status: { type: String, enum: ["invited", "registered", "not_accepted"], default: "invited" },
    approved: { type: Boolean, default: false },
    questionnaires_completed: { type: Boolean, default: false },
    lots_entered: { type: Boolean, default: false },
    invited_at: { type: Date, default: Date.now }
  }],
  
  // Auto accept participants
  auto_accept: { type: Boolean, default: false },
  
  status: { type: String, enum: ["draft", "published", "Scheduled", "Active", "Paused", "Ended"], default: "draft" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  previewEmail: { type: String },
  
  // costParams: {
  //   priceWeight: { type: Number, default: 1 },
  //   fobWeight: { type: Number, default: 0 },
  //   taxWeight: { type: Number, default: 0 },
  //   dutyWeight: { type: Number, default: 0 },
  //   performanceWeight: { type: Number, default: 0 },
  //   qualityRequirements: String,
  // },
}, { timestamps: true });

export default mongoose.model("Auction", auctionSchema);
