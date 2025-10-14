import mongoose from "mongoose";

const bidHistorySchema = new mongoose.Schema({
  // References
  auction: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Auction", 
    required: true 
  },
  lot: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "EventLot", 
    required: true 
  },
  supplier: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  
  // Bid details
  amount: { 
    type: Number, 
    required: true 
  },
  currency: { 
    type: String, 
    required: true 
  },
  fob: { 
    type: Number, 
    required: true 
  },
  carton: { 
    type: Number, 
    required: true 
  },
  tax: { 
    type: Number, 
    required: true 
  },
  duty: { 
    type: Number, 
    required: true 
  },
  totalCost: { 
    type: Number, 
    required: true 
  },
  
  // Supplier name for easy access
  supplierName: { 
    type: String, 
    required: true 
  }
}, { 
  timestamps: true 
});

// Index for efficient querying by lot and supplier
bidHistorySchema.index({ lot: 1, supplier: 1, createdAt: -1 });

export default mongoose.model("BidHistory", bidHistorySchema);