import mongoose from "mongoose";

const currencyRateSchema = new mongoose.Schema({
  currency: {
    type: String,
    required: true,
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
  },
  rate: {
    type: mongoose.Schema.Types.Decimal128, // more precise
    required: true,
  },
}, {
  timestamps: true
});
currencyRateSchema.set('toJSON', {
  transform: (doc, ret) => {
    // Convert Decimal128 to string for JSON output
    if (ret.rate) ret.rate = parseFloat(ret.rate.toString());
    return ret;
  }
});

export default mongoose.model("CurrencyRate", currencyRateSchema);