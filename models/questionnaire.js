import mongoose from "mongoose";

const questionnaireSchema = new mongoose.Schema({
  event_id: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
  name: { type: String, required: false },
  question_text: { type: String, required: true },
  question_type: { type: String, required: true },
  deadline: { type: Date },
  pre_qualification: { type: Boolean, default: false },
  scoring: { type: Boolean, default: false },
  weighting: { type: Number, default: 0 },
  order_index: { type: Number, required: true, default: 0 },
  answer: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

export default mongoose.model("Questionnaire", questionnaireSchema);
