import express from "express";
import { authenticate, authorizeRoles } from "../middlewares/auth.js";
import { sendAwardNoticeEmail } from "../utils/mailer.js";
import user from "../models/user.js";

const router = express.Router();

// Send award notice
router.post("/", authenticate, authorizeRoles("Admin"), async (req, res) => {
  try {
    const { supplierEmail, emailText, lotId, lotName, purchaseOrderNumber, ccEmail } = req.body;

    // Validate required fields
    if (!supplierEmail || !emailText || !lotId || !lotName) {
      return res.status(400).json({
        message: "Missing required fields: supplierEmail, emailText, lotId, and lotName are required"
      });
    }

    // Log the award notice details
    console.log("Sending Award Notice:");
    console.log("Supplier Email:", supplierEmail);
    console.log("Lot ID:", lotId);
    console.log("Lot Name:", lotName);
    console.log("Sent by:", req.user);

    const senderEmail = await user.findById(req.user.userId);
    console.log("sent byyyy ", senderEmail);


    // Send the actual email
    await sendAwardNoticeEmail(
      supplierEmail,
      lotName,
      emailText,
      purchaseOrderNumber,
      ccEmail,
      senderEmail.name || senderEmail.email
    );
    res.status(200).json({
      success: true,
      message: "Award notice sent successfully",
      data: {
        supplierEmail,
        lotId,
        lotName,
        sentBy: req.user.email,
        sentAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("Error sending award notice:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send award notice",
      error: error.message
    });
  }
});

export default router;