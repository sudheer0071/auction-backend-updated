import express from "express";
import { authenticate, authorizeRoles } from "../middlewares/auth.js";
import { submitBid, updateBid, getBidHistory, getCompleteBidHistory, getAuctionRanking, getAuctionBidConstraints } from "../controllers/bidController.js";

const router = express.Router();

// Suppliers submit a new bid
router.post("/", authenticate, authorizeRoles("supplier"), submitBid);

// suppliers update their bid
router.put("/:bidId", authenticate, authorizeRoles("supplier"), updateBid);

// suppliers get their bid history for an auction
// it could be supplier as well as admin
router.get("/history/:auctionId", authenticate, authorizeRoles("supplier", "Admin"), getBidHistory);

// Get auction ranking
router.get("/ranking/:auctionId", authenticate, getAuctionRanking);

// Get auction bid constraints (percentage limits using existing auction settings)
router.get("/constraints/:auctionId", authenticate, authorizeRoles("supplier"), getAuctionBidConstraints);

// Get complete bid history by lot and supplier
router.get("/complete-history", authenticate, getCompleteBidHistory);

export default router;