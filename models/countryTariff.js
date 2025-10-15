import mongoose from "mongoose";

const countryTariffSchema = new mongoose.Schema({
  country: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  tariff: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    min: 1,
    max: 100,
  },
  landFreightCost: {
    type: mongoose.Schema.Types.Decimal128,
    required: false,
    min: 0,
  },
  seaFreightCost: {
    type: mongoose.Schema.Types.Decimal128,
    required: false,
    min: 0,
  },
}, {
  timestamps: true
});

countryTariffSchema.set('toJSON', {
  transform: (doc, ret) => {
    // Convert Decimal128 to number for JSON output
    if (ret.tariff) ret.tariff = parseFloat(ret.tariff.toString());
    if (ret.landFreightCost) ret.landFreightCost = parseFloat(ret.landFreightCost.toString());
    if (ret.seaFreightCost) ret.seaFreightCost = parseFloat(ret.seaFreightCost.toString());
    return ret;
  }
});

export default mongoose.model("CountryTariff", countryTariffSchema);