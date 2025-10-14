// import mongoose from "mongoose";

// const dutyTableSchema = new mongoose.Schema({
//   country: { type: String, required: true },
//   productCategory: { type: String, required: true },
//   dutyRate: { type: Number, required: true }, // e.g., 5.5 for 5.5%
//   createdAt: { type: Date, default: Date.now }
// });

// export default mongoose.model("DutyTable", dutyTableSchema);

import mongoose from 'mongoose';

const importDutySchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  country: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', required: true },
  dutyRate: { type: mongoose.Schema.Types.Decimal128, default: null } // can be filled later
}, { timestamps: true });

importDutySchema.index({ product: 1, country: 1 }, { unique: true });

export default mongoose.model('ImportDuty', importDutySchema);

