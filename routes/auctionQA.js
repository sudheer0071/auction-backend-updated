import express from "express";
import { askQuestion, answerQuestion, getAuctionQA } from "../controllers/auctionQAController.js";
import { authenticate } from "../middlewares/auth.js";

const router = express.Router();

router.post("/ask", authenticate, askQuestion);
router.post("/answer/:qaId", authenticate, answerQuestion);
router.get("/:auctionId", authenticate, getAuctionQA);

export default router; 