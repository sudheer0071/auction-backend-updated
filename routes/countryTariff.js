import express from "express";
import { 
  createCountryTariff, 
  updateCountryTariff, 
  getAllCountryTariffs, 
  getCountryTariffByCountry,
  deleteCountryTariff 
} from "../controllers/countryTariffController.js";
import { authenticate, authorizeRoles } from "../middlewares/auth.js";

const router = express.Router();

// Create or update country tariff
router.post("/", createCountryTariff);

// Get all country tariffs
router.get("/", getAllCountryTariffs);

// Get tariff by country
router.get("/:country", getCountryTariffByCountry);

// Update tariff for specific country
router.put("/:country", updateCountryTariff);

// Delete country tariff
router.delete("/", deleteCountryTariff);

export default router;