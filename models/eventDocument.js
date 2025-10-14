import mongoose from "mongoose";

const eventDocumentSchema = new mongoose.Schema({
  event_id: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
  name: { type: String, required: true },
  file_path: { type: String, required: false },
  file_size: { type: Number, required: true },
  mime_type: { type: String, required: false },
  version: { type: Number, required: true, default: 1 },
  shared_with_all: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model("EventDocument", eventDocumentSchema);
