import mongoose from "mongoose";

const auctionSettingsSchema = new mongoose.Schema({
  event_id: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
  start_date: { type: Date },
  start_time: { type: String, required: true, default: "09:00" },
  end_date: { type: Date },
  end_time: { type: String, required:true },
  bid_direction: { type: String, enum: ["forward", "reverse"], required: true, default: "reverse" },
  event_type: { type: String, enum: ["ranked", "sealed"], required: true, default: "ranked" },
  minimum_duration: { type: Number, required: true, default: 10 }, // in minutes
  dynamic_close_period: { type: String, required: true, default: "none" },
  
  // Bid validation settings
  minimum_bid_change: { type: Number, required: true, default: 0.50 }, // Legacy field (not used in new validation)
  maximum_bid_change: { type: Number, required: true, default: 10.00 }, // Maximum percentage above current price (e.g., 120 for 20% above)
  
  tied_bid_option: { type: String, required: true, default: "equal_worst_position" },
}, { timestamps: true });

export default mongoose.model("AuctionSettings", auctionSettingsSchema);
