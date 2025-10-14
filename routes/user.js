import express from "express";
import { getAllSupplier, getProfile, getUserByEmail, updateProfile } from "../controllers/userController.js";
import { authenticate } from "../middlewares/auth.js";

const router = express.Router();

router.get("/profile", authenticate, getProfile);
router.put("/profile", authenticate, updateProfile);
router.get("/by-email", getUserByEmail);
router.get("/allsupplier", getAllSupplier);
export default router;