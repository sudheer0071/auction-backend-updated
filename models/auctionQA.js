import mongoose from "mongoose";

const auctionQASchema = new mongoose.Schema({
  auction: { type: mongoose.Schema.Types.ObjectId, ref: "Auction", required: true },
  askedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  question: { type: String, required: true },
  answer: { type: String },
  answeredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
  answeredAt: { type: Date }
});

export default mongoose.model("AuctionQA", auctionQASchema);