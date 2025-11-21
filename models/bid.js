import mongoose from "mongoose";

const bidSchema = new mongoose.Schema({
  auction: { type: mongoose.Schema.Types.ObjectId, ref: "Auction", required: true },
  lot: { type: mongoose.Schema.Types.ObjectId, ref: "Lot" },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  amount: { type: Number, required: true }, // Stored in GBP after conversion
  originalAmount: { type: Number }, // Original amount in supplier's currency
  currency: { type: String, required: true }, // Supplier's original currency
  fob: { type: Number, required: true },
  carton: { type: Number, required: true },
  tax: { type: Number, required: true },
  duty: { type: Number, required: true },
  totalCost: { type: Number, required: true },
  landed_cost: { type: Number, default: 0 },
  performanceScore: { type: Number, default: 0 },
  status: { type: String, enum: ["Active", "Withdrawn"], default: "Active" },
  bidRange: {
    min: { type: Number },
    max: { type: Number }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

export default mongoose.model("Bid", bidSchema);