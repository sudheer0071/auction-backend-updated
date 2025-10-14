import mongoose from "mongoose";
import Message from "../models/message.js";
import User from "../models/user.js";
import EventLot from "../models/eventLot.js";
import EventParticipant from "../models/eventParticipant.js";

// Send a new message (from admin to participant or vice versa)
export const sendMessage = async (req, res) => {
  try {
    const { event_id, participant_id, lot_id, message } = req.body;
    const sender_id = req.user.userId; // From auth middleware

    // Validate required fields
    if (!event_id || !participant_id || !message) {
      return res.status(400).json({
        message: "event_id, participant_id, and message are required"
      });
    }

    // Get sender details
    const sender = await User.findById(sender_id);
    if (!sender) {
      return res.status(404).json({ message: "Sender not found" });
    }

    // Verify participant exists
    const participant = await EventParticipant.findById(participant_id);
    if (!participant) {
      return res.status(404).json({ message: "Participant not found" });
    }

    // Optionally verify lot exists if lot_id is provided
    if (lot_id) {
      const lot = await EventLot.findById(lot_id);
      if (!lot) {
        return res.status(404).json({ message: "Lot not found" });
      }
    }

    // Determine sender type
    const sender_type = sender.role === "supplier" ? "supplier" : "admin";

    // Create new message
    const messageData = {
      event_id,
      participant_id,
      sender_id,
      sender_type,
      message,
    };

    // Add lot_id if provided
    if (lot_id) {
      messageData.lot_id = lot_id;
    }

    const newMessage = new Message(messageData);
    await newMessage.save();

    // Populate sender info for response
    const populatedMessage = await Message.findById(newMessage._id)
      .populate("sender_id", "name email role")
      .populate("participant_id");

    // Emit socket event if io is available
    const io = req.app.get("io");
    if (io) {
      // Emit to specific event and participant room
      io.to(`event_${event_id}_participant_${participant_id}`).emit("newMessage", populatedMessage);
    }

    res.status(201).json({
      message: "Message sent successfully",
      data: populatedMessage,
    });
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({
      message: "Failed to send message",
      error: err.message
    });
  }
};

// Get all messages for a specific participant conversation
export const getMessages = async (req, res) => {
  try {
    const { event_id, participant_id } = req.params;
    const { lot_id } = req.query; // Optional: filter by specific lot
    const user_id = req.user.userId; // From auth middleware

    if (!event_id || !participant_id) {
      return res.status(400).json({ message: "event_id and participant_id are required" });
    }

    // Build query
    let query = { event_id, participant_id };

    // Filter by lot_id if provided
    if (lot_id) {
      query.lot_id = lot_id;
    }

    const messages = await Message.find(query)
      .populate("sender_id", "name email role")
      .populate("participant_id")
      .populate("lot_id", "name")
      .sort({ createdAt: 1 }); // Oldest first

    // Mark messages as read for the current user
    const user = await User.findById(user_id);
    const updateQuery = {
      event_id,
      participant_id,
      is_read: false
    };

    // If supplier, mark admin messages as read
    // If admin, mark supplier messages as read
    if (user.role === "supplier") {
      updateQuery.sender_type = "admin";
    } else {
      updateQuery.sender_type = "supplier";
    }

    if (lot_id) {
      updateQuery.lot_id = lot_id;
    }

    await Message.updateMany(
      updateQuery,
      {
        $set: { is_read: true, read_at: new Date() }
      }
    );

    res.status(200).json({
      message: "Messages retrieved successfully",
      count: messages.length,
      data: messages,
    });
  } catch (err) {
    console.error("Get messages error:", err);
    res.status(500).json({
      message: "Failed to retrieve messages",
      error: err.message
    });
  }
};

// Get unread message count for an event (for admin - shows count per participant)
export const getUnreadCount = async (req, res) => {
  try {
    const { event_id } = req.params;
    const user_id = req.user.userId;

    const user = await User.findById(user_id);

    let unreadCounts;

    if (user.role === "supplier") {
      // Supplier: Count unread messages from admin in their conversations
      unreadCounts = await Message.countDocuments({
        event_id,
        sender_type: "admin",
        is_read: false
      });
    } else {
      // Admin: Get unread count per participant
      unreadCounts = await Message.aggregate([
        {
          $match: {
            event_id: new mongoose.Types.ObjectId(event_id),
            sender_type: "supplier",
            is_read: false
          }
        },
        {
          $group: {
            _id: "$participant_id",
            unreadCount: { $sum: 1 }
          }
        },
        {
          $lookup: {
            from: "eventparticipants",
            localField: "_id",
            foreignField: "_id",
            as: "participant"
          }
        },
        {
          $unwind: "$participant"
        },
        {
          $project: {
            participant_id: "$_id",
            participant: 1,
            unreadCount: 1
          }
        }
      ]);
    }

    res.status(200).json({
      message: "Unread count retrieved successfully",
      data: unreadCounts,
    });
  } catch (err) {
    console.error("Get unread count error:", err);
    res.status(500).json({
      message: "Failed to get unread count",
      error: err.message
    });
  }
};

// Get all conversations for an event (for admin - list of participants with last message)
export const getConversations = async (req, res) => {
  try {
    const { event_id } = req.params;
    const user_id = req.user.userId;

    // Verify user is admin
    const user = await User.findById(user_id);
    if (user.role === "supplier") {
      return res.status(403).json({
        message: "Only admins can view all conversations"
      });
    }

    // Get unique participants with latest message and unread count
    const conversations = await Message.aggregate([
      {
        $match: { event_id: new mongoose.Types.ObjectId(event_id) }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: "$participant_id",
          lastMessage: { $first: "$$ROOT" },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$sender_type", "supplier"] },
                    { $eq: ["$is_read", false] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: "eventparticipants",
          localField: "_id",
          foreignField: "_id",
          as: "participant"
        }
      },
      {
        $unwind: "$participant"
      },
      {
        $project: {
          participant: 1,
          lastMessage: 1,
          unreadCount: 1
        }
      },
      {
        $sort: { "lastMessage.createdAt": -1 }
      }
    ]);

    res.status(200).json({
      message: "Conversations retrieved successfully",
      data: conversations,
    });
  } catch (err) {
    console.error("Get conversations error:", err);
    res.status(500).json({
      message: "Failed to retrieve conversations",
      error: err.message
    });
  }
};

// Get participant ID for the logged-in supplier
export const getMyParticipantId = async (req, res) => {
  try {
    const { event_id } = req.params;
    const user_id = req.user.userId;

    // Get user to find their email
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find participant by email and event
    const participant = await EventParticipant.findOne({
      event_id,
      "participant.email": user.email
    });

    if (!participant) {
      return res.status(404).json({ message: "You are not a participant in this event" });
    }

    res.status(200).json({
      message: "Participant ID retrieved successfully",
      data: {
        participant_id: participant._id,
        participant: participant.participant
      }
    });
  } catch (err) {
    console.error("Get participant ID error:", err);
    res.status(500).json({
      message: "Failed to get participant ID",
      error: err.message
    });
  }
};
