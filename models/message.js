import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  event_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: true
  },
  lot_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "EventLot",
    required: false // Optional - for lot-specific messages
  },
  participant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "EventParticipant",
    required: true // Reference to the participant (supplier) in this conversation
  },
  sender_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true // The actual user who sent the message (either admin or supplier)
  },
  sender_type: {
    type: String,
    enum: ["admin", "supplier"],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  is_read: {
    type: Boolean,
    default: false
  },
  read_at: {
    type: Date
  },
}, { timestamps: true });

// Index for efficient querying
messageSchema.index({ event_id: 1, participant_id: 1, createdAt: -1 });
messageSchema.index({ lot_id: 1, createdAt: -1 });
messageSchema.index({ participant_id: 1, createdAt: -1 });

export default mongoose.model("Message", messageSchema);
