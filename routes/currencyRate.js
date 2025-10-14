import express from "express";
import { addCurrencyRate, deleteCurrencyRate, getAllCurrencyRates, getCurrencyRateByCode, updateCurrencyRate } from "../controllers/currencyRateController.js";
import { authenticate, authorizeRoles } from "../middlewares/auth.js";

const router = express.Router();
router.post("/", addCurrencyRate);

// router.post("/", authorizeRoles("Admin", "Manager", "Viewer"), addCurrencyRate);
router.get("/", getAllCurrencyRates);
router.get("/:code", getCurrencyRateByCode);
router.put("/:code", updateCurrencyRate);
router.delete('/', deleteCurrencyRate);


export default router;