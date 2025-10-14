import mongoose from "mongoose";
import CurrencyRate from "../models/currencyRate.js";

// export const addCurrencyRate = async (req, res) => {
//   try {
//     const { from, to, rate } = req.body;
//     const currencyRate = new CurrencyRate({ from, to, rate });
//     await currencyRate.save();
//     res.status(201).json({ message: "Currency rate added", currencyRate });
//   } catch (err) {
//     res.status(500).json({ message: "Failed to add currency rate", error: err.message });
//   }
// };

// export const getCurrencyRates = async (req, res) => {
//   try {
//     const rates = await CurrencyRate.find();
//     res.json(rates);
//   } catch (err) {
//     res.status(500).json({ message: "Failed to fetch currency rates", error: err.message });
//   }
// };

export const addCurrencyRate = async (req, res) => {
  try {
    const { currency, code, rate } = req.body;
console.log(req.body, "bbbbbbbbbbbb")
    const decimalRate = mongoose.Types.Decimal128.fromString(rate.toString());

    let currencyRate = await CurrencyRate.findOne({ code});

    if (currencyRate) {
      currencyRate.rate = decimalRate;
      currencyRate.date = new Date();
      await currencyRate.save();
      return res.status(200).json({ message: "Currency rate updated", currencyRate });
    } else {
      currencyRate = new CurrencyRate({ currency, code, rate: decimalRate });
      await currencyRate.save();
      return res.status(201).json({ message: "Currency rate added", currencyRate });
    }

  } catch (err) {
    res.status(500).json({ message: "Failed to add/update currency rate", error: err.message });
  }
};

export const deleteCurrencyRate = async (req, res) => {
  try {
    const { code } = req.body;
    console.log(code, "code>>>>");
    const currencyRate = await CurrencyRate.findOneAndDelete({ code });
    console.log(currencyRate, "currencyrate>>>>");

    if (!currencyRate) {
      return res.status(404).json({ message: "Currency rate not found" });
    }

    res.status(200).json({ message: "Currency rate deleted", currencyRate });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete currency rate", error: err.message });
  }
};

// Get All Currency Rates (with parsed decimals)
export const getAllCurrencyRates = async (req, res) => {
  try {
    const currencyRates = await CurrencyRate.find();

    // Convert Decimal128 to number for each rate
    const formattedRates = currencyRates.map(rate => ({
      _id: rate._id,
      currency: rate.currency,
      code: rate.code,
      rate: parseFloat(rate.rate.toString()),
      createdAt: rate.createdAt,
      updatedAt: rate.updatedAt
    }));

    res.status(200).json(formattedRates);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch currency rates", error: err.message });
  }
};

export const updateCurrencyRate = async (req, res) => {
  try {
    const { code } = req.params;
    const {  rate } = req.body;

    const decimalRate = mongoose.Types.Decimal128.fromString(rate.toString());

    const currencyRate = await CurrencyRate.findOne({ code: code.toUpperCase() });

    if (!currencyRate) {
      return res.status(404).json({ message: `Currency rate for code '${code}' not found` });
    }

    // currencyRate.currency = currency || currencyRate.currency;
    currencyRate.rate = decimalRate;
    currencyRate.date = new Date();
    await currencyRate.save();

    res.status(200).json({ message: "Currency rate updated", currencyRate });
  } catch (err) {
    res.status(500).json({ message: "Failed to update currency rate", error: err.message });
  }
};

export const getCurrencyRateByCode = async (req, res) => {
  try {
    const { code } = req.params;

    const currencyRate = await CurrencyRate.findOne({ code: code.toUpperCase() });

    if (!currencyRate) {
      return res.status(404).json({ message: `Currency rate for code '${code}' not found` });
    }

    const formattedRate = {
      _id: currencyRate._id,
      currency: currencyRate.currency,
      code: currencyRate.code,
      rate: parseFloat(currencyRate.rate.toString()),
      createdAt: currencyRate.createdAt,
      updatedAt: currencyRate.updatedAt,
    };

    res.status(200).json(formattedRate);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch currency rate", error: err.message });
  }
};