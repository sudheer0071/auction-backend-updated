import mongoose from "mongoose";
import CountryTariff from "../models/countryTariff.js";

// Create a new country tariff
export const createCountryTariff = async (req, res) => {
  try {
    const { country, tariff, landFreightCost, seaFreightCost } = req.body;

    // Validate tariff range
    if (tariff < 1 || tariff > 100) {
      return res.status(400).json({ message: "Tariff must be between 1 and 100" });
    }

    const decimalTariff = mongoose.Types.Decimal128.fromString(tariff.toString());
    const decimalLandFreight = landFreightCost ? mongoose.Types.Decimal128.fromString(landFreightCost.toString()) : undefined;
    const decimalSeaFreight = seaFreightCost ? mongoose.Types.Decimal128.fromString(seaFreightCost.toString()) : undefined;

    // Check if country already exists
    let countryTariff = await CountryTariff.findOne({ country: country.trim() });

    if (countryTariff) {
      // Update existing country tariff
      countryTariff.tariff = decimalTariff;
      if (decimalLandFreight !== undefined) countryTariff.landFreightCost = decimalLandFreight;
      if (decimalSeaFreight !== undefined) countryTariff.seaFreightCost = decimalSeaFreight;
      await countryTariff.save();
      return res.status(200).json({ message: "Country tariff updated", countryTariff });
    } else {
      // Create new country tariff
      const tariffData = {
        country: country.trim(),
        tariff: decimalTariff
      };
      if (decimalLandFreight !== undefined) tariffData.landFreightCost = decimalLandFreight;
      if (decimalSeaFreight !== undefined) tariffData.seaFreightCost = decimalSeaFreight;

      countryTariff = new CountryTariff(tariffData);
      await countryTariff.save();
      return res.status(201).json({ message: "Country tariff created", countryTariff });
    }

  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "Country already exists" });
    }
    res.status(500).json({ message: "Failed to create country tariff", error: err.message });
  }
};

// Update tariff for a specific country
export const updateCountryTariff = async (req, res) => {
  try {
    const { country } = req.params;
    const { tariff, landFreightCost, seaFreightCost } = req.body;

    // Validate tariff range
    if (tariff < 1 || tariff > 100) {
      return res.status(400).json({ message: "Tariff must be between 1 and 100" });
    }

    const decimalTariff = mongoose.Types.Decimal128.fromString(tariff.toString());
    const decimalLandFreight = landFreightCost ? mongoose.Types.Decimal128.fromString(landFreightCost.toString()) : undefined;
    const decimalSeaFreight = seaFreightCost ? mongoose.Types.Decimal128.fromString(seaFreightCost.toString()) : undefined;

    const countryTariff = await CountryTariff.findOne({ country: country.trim() });

    if (!countryTariff) {
      return res.status(404).json({ message: `Country tariff for '${country}' not found` });
    }

    countryTariff.tariff = decimalTariff;
    if (decimalLandFreight !== undefined) countryTariff.landFreightCost = decimalLandFreight;
    if (decimalSeaFreight !== undefined) countryTariff.seaFreightCost = decimalSeaFreight;
    await countryTariff.save();

    res.status(200).json({ message: "Country tariff updated", countryTariff });
  } catch (err) {
    res.status(500).json({ message: "Failed to update country tariff", error: err.message });
  }
};

// Get all country tariffs
export const getAllCountryTariffs = async (req, res) => {
  try {
    const countryTariffs = await CountryTariff.find().sort({ country: 1 });

    // Convert Decimal128 to number for each tariff
    const formattedTariffs = countryTariffs.map(tariff => ({
      _id: tariff._id,
      country: tariff.country,
      tariff: parseFloat(tariff.tariff.toString()),
      landFreightCost: tariff.landFreightCost ? parseFloat(tariff.landFreightCost.toString()) : null,
      seaFreightCost: tariff.seaFreightCost ? parseFloat(tariff.seaFreightCost.toString()) : null,
      createdAt: tariff.createdAt,
      updatedAt: tariff.updatedAt
    }));

    res.status(200).json(formattedTariffs);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch country tariffs", error: err.message });
  }
};

// Get tariff by country
export const getCountryTariffByCountry = async (req, res) => {
  try {
    const { country } = req.params;

    const countryTariff = await CountryTariff.findOne({ country: country.trim() });

    if (!countryTariff) {
      return res.status(404).json({ message: `Country tariff for '${country}' not found` });
    }

    const formattedTariff = {
      _id: countryTariff._id,
      country: countryTariff.country,
      tariff: parseFloat(countryTariff.tariff.toString()),
      landFreightCost: countryTariff.landFreightCost ? parseFloat(countryTariff.landFreightCost.toString()) : null,
      seaFreightCost: countryTariff.seaFreightCost ? parseFloat(countryTariff.seaFreightCost.toString()) : null,
      createdAt: countryTariff.createdAt,
      updatedAt: countryTariff.updatedAt,
    };

    res.status(200).json(formattedTariff);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch country tariff", error: err.message });
  }
};

// Delete country tariff
export const deleteCountryTariff = async (req, res) => {
  try {
    const { country } = req.body;

    const countryTariff = await CountryTariff.findOneAndDelete({ country: country.trim() });

    if (!countryTariff) {
      return res.status(404).json({ message: "Country tariff not found" });
    }

    res.status(200).json({ message: "Country tariff deleted", countryTariff });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete country tariff", error: err.message });
  }
};