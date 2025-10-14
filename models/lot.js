import mongoose from "mongoose";

const lotSchema = new mongoose.Schema({
  auction: { type: mongoose.Schema.Types.ObjectId, ref: "Auction", required: true },
  lotId: { type: String, required: true },
  name: { type: String, required: true },
  material: { type: String, required: true },
  volume: { type: String, required: true },
  prevCost: { type: String, required: true },
  hsCode: { type: String, required: true },
  dimensions: { type: Object },
  
  // Additional fields for enhanced lot data
  productName: { type: String }, // alias for name
  description: { type: String },
  specifications: { type: String },
  documents: [{ type: String }], // file paths or URLs
  reservePrice: { type: Number },
  currency: { type: String },
  
  // Event-based lot fields (for RFQ functionality)
  quantity: { type: Number },
  unit_of_measure: { type: String },
  current_price: { type: Number },
  qualification_price: { type: Number },
  current_value: { type: Number },
  qualification_value: { type: Number },
}, { timestamps: true });

export default mongoose.model("Lot", lotSchema);