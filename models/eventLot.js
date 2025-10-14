import mongoose from "mongoose";

const eventLotSchema = new mongoose.Schema({
  event_id: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true },
  unit_of_measure: { type: String, required: true },
  current_price: { type: Number, required: true },
  qualification_price: { type: Number, required: true },
  current_value: { type: Number, required: true },
  qualification_value: { type: Number, required: true },
}, { timestamps: true });

export default mongoose.model("EventLot", eventLotSchema);
