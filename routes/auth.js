import express from "express";
import { register, login, verifyOtp, createEpMember, forgotPassword, verifyForgotOtp, resetPassword } from "../controllers/authController.js";
import { resendOtp } from "../controllers/authController.js";
import { authenticate, authorizeRoles } from "../middlewares/auth.js";

const router = express.Router();

// Registration route
router.post("/register", register);

// Login route
router.post("/login", login);

// OTP verification route
router.post("/verify-otp", verifyOtp);

router.post("/forgot-password", forgotPassword);
router.post("/verify-forgot-otp", verifyForgotOtp);
router.post("/resend-otp", resendOtp);
router.post("/reset-password", resetPassword);

// Admin creates EP member accounts
router.post(
  "/create-ep-member",
  // authenticate,
  // authorizeRoles("Admin"),
  createEpMember
);

export default router;