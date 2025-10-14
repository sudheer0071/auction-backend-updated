import express from "express";
import { authenticate, authorizeRoles } from "../middlewares/auth.js";
import {
  sendMessage,
  getMessages,
  getUnreadCount,
  getConversations,
  getMyParticipantId
} from "../controllers/messageController.js";

const router = express.Router();

// Send a new message (both admin and supplier)
router.post("/", authenticate, sendMessage);

// Get all messages for a specific participant conversation
router.get("/event/:event_id/participant/:participant_id", authenticate, getMessages);

// Get unread message count for a specific event
router.get("/unread/:event_id", authenticate, getUnreadCount);

// Get all conversations for an event (admin only)
router.get("/conversations/:event_id", authenticate, authorizeRoles("Admin", "Manager"), getConversations);

// Get participant ID for the logged-in supplier
router.get("/my-participant/:event_id", authenticate, getMyParticipantId);

export default router;
