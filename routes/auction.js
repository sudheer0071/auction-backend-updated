import express from "express";
import {
  createAuction,
  createCompleteEvent,
  listAuctions,
  getAuctionDetails,
  pauseAuction,
  resumeAuction,
  endAuction,
  getAuctionMonitoring,
  listSingleAuctions,
  addAnnouncement,
  getAnnouncements,
  deleteAnnouncement,
} from "../controllers/auctionController.js";
import { authenticate, authorizeRoles } from "../middlewares/auth.js";
import upload from "../utils/multerConfig.js"; 
import { createCompleteEventNormalized, updateCompleteEventNormalized, getAuctionByIdNormalized } from "../controllers/auctionController_fixed.js";

const router = express.Router();

// Create complete event/auction (new structure from frontend)
router.post(
  "/create",
  authenticate,
  authorizeRoles("Admin", "Manager", "Viewer"),
  createCompleteEventNormalized
);

// Update complete event/auction (new structure from frontend)
router.put(
  "/:id",
  authenticate,
  authorizeRoles("Admin", "Manager", "Viewer"),
  updateCompleteEventNormalized
);

// Legacy auction creation (for backward compatibility)
router.post(
  "/create-legacy",
  authenticate,
  authorizeRoles("Admin", "Manager", "Viewer"),
  upload.fields([
    { name: "auctionDocs", maxCount: 5 },
    { name: "lotDocs0", maxCount: 5 },
    { name: "lotDocs1", maxCount: 5 },
    // Add more lotDocs fields as needed for lots
  ]),
  createAuction
);

// List auctions
router.get("/", authenticate, listAuctions);
router.get("/id", authenticate, listSingleAuctions);
// Get auction details
router.get("/:id", authenticate, getAuctionByIdNormalized);

// Pause auction
router.post(
  "/:id/pause",
  authenticate,
  authorizeRoles("Admin", "Manager", "Viewer"),
  pauseAuction
);

// Resume auction
router.post(
  "/:id/resume",
  authenticate,
  authorizeRoles("Admin", "Manager", "Viewer"),
  resumeAuction
);

// End auction
router.post(
  "/:id/end",
  authenticate,
  authorizeRoles("Admin", "Manager", "Viewer"),
  endAuction
);

// Get auction monitoring
router.get(
  "/:id/monitoring",
  authenticate,
  authorizeRoles("Admin", "Manager", "Viewer"),
  getAuctionMonitoring
);

// Announcement routes
router.post(
  "/:id/announcements",
  authenticate,
  authorizeRoles("Admin", "Manager"),
  addAnnouncement
);

router.get(
  "/:id/announcements",
  authenticate,
  getAnnouncements
);

router.delete(
  "/:id/announcements/:announcementId",
  authenticate,
  authorizeRoles("Admin", "Manager"),
  deleteAnnouncement
);

export default router;