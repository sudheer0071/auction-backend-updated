import Bid from "../models/bid.js";
import Auction from "../models/auction.js";
import AuctionSettings from "../models/auctionSettings.js";
import Lot from "../models/lot.js";
import { convertCurrencyToGBP, convertGBPToCurrency, validateBidAgainstPriceLimits, validateBidAgainstReservePrice } from "../utils/currencyUtils.js";
import User from "../models/user.js";
import eventLot from "../models/eventLot.js";
import BidHistory from "../models/bidHistory.js";

// Helper function to broadcast updated rankings
export const broadcastUpdatedRankings = async (io, auctionId, auctionSettings, socket = null) => {
  try {
    // Get all active bids for this auction
    const allBids = await Bid.find({ 
      auction: auctionId, 
      status: "Active" 
    }).populate("supplier", "email");

    // Sort by totalCost (lowest first)
    const sortedBids = allBids.sort((a, b) => a.totalCost - b.totalCost);

    // Create ranking data with ranks
    const rankings = sortedBids.map((bid, idx) => ({
      supplierId: bid.supplier._id,
      supplierEmail: bid.supplier.email,
      bidId: bid._id,
      totalCost: bid.totalCost,
      rank: idx + 1, 
      currency:bid.currency
    }));

    if (socket) {
      // io.emit("rankingUpdate", { rankings });
      socket.emit("rankingUpdate", { rankings });
      console.log(`Sent ranking update for auction ${auctionId} to a single socket.`);
    } else {
      io.emit("rankingUpdate", { rankings });
      console.log(`Broadcasting ranking update for auction ${auctionId}:`, rankings);
    }
  } catch (error) {
    console.error("Error broadcasting rankings:", error);
  }
};
// Submit a new bid
export const submitBid = async (req, res) => {
  try {
    const { auctionId, lotId, amount, currency, fob, carton, tax, duty, performanceScore } = req.body;

    // Check if auction exists and supplier is invited
    const auction = await Auction.findById(auctionId); 
    console.log("auction .... ", auction);
            
    if (!auction) return res.status(404).json({ message: "Auction not found" });

    // Fetch auction settings - required for bid validation
    const auctionSettings = await AuctionSettings.findOne({ event_id: auctionId });
    console.log("auction settings ..... ", auctionSettings);

    // Auction settings are required for bid validation
    if (!auctionSettings) {
      return res.status(400).json({ 
        message: "Auction settings not found. Please configure auction settings with percentage limits before accepting bids." 
      });
    }

    // Fetch lot data to get current_price as reference
    const lot = await eventLot.findById(lotId);
    if (!lot) {
      return res.status(404).json({ message: "Lot not found" });
    }

    // Lot current_price is required for percentage-based validation
    if (!lot.current_price || lot.current_price <= 0) {
      return res.status(400).json({ 
        message: "Lot current price not set. Please configure a valid current_price for this lot before accepting bids." 
      });
    }

    // get the user email by req.user.userId user table by importing User modal 
    const user = await User.findById(req.user.userId);
    const userEmail = user.email;
    console.log("userEmail .... ", userEmail);

    if (!auction.invitedSupplierEmail.includes(userEmail)) {
      return res.status(403).json({ message: "You are not invited to this auction" });
    }
    if (auction.status !== "published") {
      return res.status(400).json({ message: "Auction is not active" });
    }

    // Simple bid validation based on bid_direction and lot.qualification_price
    const bidDirection = auctionSettings.bid_direction || "reverse";
    const qualificationPrice = lot.qualification_price;
    if (typeof qualificationPrice !== "number") {
      return res.status(400).json({
        message: "Lot qualification_price not set. Please configure a valid qualification_price for this lot before accepting bids."
      });
    }
    const convertedQualificationPrice = await convertGBPToCurrency(qualificationPrice, currency);
    console.log("convertedQualificationPrice .... ", convertedQualificationPrice);
    if (bidDirection === "forward") {
      if (!(amount > convertedQualificationPrice.convertedAmount)) {
        return res.status(400).json({
          message: `Bid amount must be greater than the qualification price (${convertedQualificationPrice.convertedAmount} ${currency}) for forward auctions.`
        });
      }
    } else if (bidDirection === "reverse") {
      if (!(amount < convertedQualificationPrice.convertedAmount)) {
        return res.status(400).json({
          message: `Bid amount must be less than the qualification price (${convertedQualificationPrice.convertedAmount} ${currency}) for reverse auctions.`
        });
      }
    } else {
      return res.status(400).json({
        message: `Unknown bid direction: ${bidDirection}`
      });
    }

      const validation = await validateBidAgainstPriceLimits(
        amount,
        currency,
        auctionSettings,
        lot.current_price,
        lot.qualification_price,
        auction.default_currency
      );
    // Calculate total cost (can be expanded later)
    const totalCost = amount*carton + fob + tax + duty;

    // Create bid
    const bid = new Bid({
      auction: auctionId,
      lot: lotId,
      supplier: req.user.userId,
      amount,
      currency,
      fob,
      carton,
      tax,
      duty,
      totalCost,
      bidRange:{min: validation.floorPrice.toFixed(2), max: validation.ceilingPrice.toFixed(2)},
      performanceScore,
    });

    await bid.save();

    // Record bid history
    try {
      console.log("Creating bid history - auctionId:", auctionId, "lotId:", lotId, "supplier:", req.user.userId);
      await BidHistory.create({
        auction: auctionId,
        lot: lotId,
        supplier: req.user.userId,
        amount,
        currency,
        fob,
        carton,
        tax,
        duty,
        totalCost,
        supplierName: user.name || user.email
      });
    } catch (historyError) {
      console.error("Failed to record bid history:", historyError);
      // Don't fail the bid submission if history recording fails
    }

    // Emit real-time update to auction room
    const io = req.app.get("io");
    io.to(auctionId).emit("newBid", { bid });

    // Broadcast updated rankings to all users
    await broadcastUpdatedRankings(io, auctionId);

    res.status(201).json({ message: "Bid submitted", bid });
  } catch (err) {
    res.status(500).json({ message: "Bid submission failed", error: err.message });
  }
};

// Update an active bid
export const updateBid = async (req, res) => {
  try {
    const { bidId } = req.params;
    const { auctionId, amount, currency, fob, tax, duty, performanceScore } = req.body;

    const bid = await Bid.findById(bidId);
    if (!bid) return res.status(404).json({ message: "Bid not found" });
    if (!bid.supplier.equals(req.user.userId)) {
      return res.status(403).json({ message: "You can only update your own bids" });
    }
    if (bid.status !== "Active") {
      return res.status(400).json({ message: "Bid is not active" });
    }


    // Get auction data for validation
    const auction = await Auction.findOne({_id: bid.auction});
    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }


    // Fetch auction settings - required for bid validation
    const auctionSettings = await AuctionSettings.findOne({ event_id: auctionId });

    // Auction settings are required for bid validation
    if (!auctionSettings) {
      return res.status(400).json({ 
        message: "Auction settings not found. Please configure auction settings with percentage limits." 
      });
    }

    // Fetch lot data to get current_price as reference
    const lot = await eventLot.findById(bid.lot);
    if (!lot) {
      return res.status(404).json({ message: "Lot not found" });
    }

    // Lot current_price is required for percentage-based validation
    if (!lot.current_price || lot.current_price <= 0) {
      return res.status(400).json({ 
        message: "Lot current price not set. Please configure a valid current_price for this lot." 
      });
    }

    // Additional check: in reverse auction, new amount must be less than current; in forward, must be greater
    const bidDirection = auctionSettings.bid_direction || "reverse";
    
    // Before comparing, convert previous bid amount to the incoming currency for accurate comparison
    // If currencies are different, we need to convert the old bid amount to the new bid currency
    let previousBidInNewCurrency = bid.amount;
    
    if (bid.currency !== currency) {
      // Convert previous bid from its currency to the new currency via GBP
      try {
        // Step 1: Convert previous bid currency to GBP
        const previousBidToGBP = await convertCurrencyToGBP(bid.amount, bid.currency);
        if (!previousBidToGBP.success) {
          return res.status(400).json({
            message: `Failed to convert previous bid currency ${bid.currency} to GBP for comparison: ${previousBidToGBP.error}`,
            bidCurrency: currency
          });
        }

        // Step 2: Convert GBP to new currency
        const gbpToNewCurrency = await convertGBPToCurrency(previousBidToGBP.gbpAmount, currency);
        if (!gbpToNewCurrency.success) {
          return res.status(400).json({
            message: `Failed to convert GBP to ${currency} for comparison: ${gbpToNewCurrency.error}`,
            bidCurrency: currency
          });
        }

        previousBidInNewCurrency = gbpToNewCurrency.convertedAmount;
        console.log(`Currency conversion for comparison: ${bid.amount} ${bid.currency} = ${previousBidInNewCurrency.toFixed(6)} ${currency}`);
      } catch (conversionError) {
        return res.status(400).json({
          message: `Currency conversion failed for bid comparison: ${conversionError.message}`,
          bidCurrency: currency
        });
      }
    }

    if (bidDirection === "reverse") {
      if (!(amount < previousBidInNewCurrency)) {
        return res.status(400).json({
          message: `In reverse auction, new bid amount (${amount} ${currency}) must be less than your previous bid (${previousBidInNewCurrency.toFixed(2)} ${currency}).`,
          bidCurrency: currency,
          previousBidConverted: `${previousBidInNewCurrency.toFixed(2)} ${currency}`,
          originalPreviousBid: `${bid.amount} ${bid.currency}`
        });
      }
    } else if (bidDirection === "forward") {
      if (!(amount > previousBidInNewCurrency)) {
        return res.status(400).json({
          message: `In forward auction, new bid amount (${amount} ${currency}) must be greater than your previous bid (${previousBidInNewCurrency.toFixed(2)} ${currency}).`,
          bidCurrency: currency,
          previousBidConverted: `${previousBidInNewCurrency.toFixed(2)} ${currency}`,
          originalPreviousBid: `${bid.amount} ${bid.currency}`
        });
      }
    }

    // Validate bid amount using auction settings with percentage limits based on lot current_price
    try {
      console.log("Validating bid update against percentage-based price limits...");
      
      const validation = await validateBidAgainstPriceLimits(
        amount,
        currency,
        auctionSettings,
        lot.current_price,
        lot.qualification_price,
        auction.default_currency
      );
      
      if (!validation.isValid) {
        return res.status(400).json({
          message: validation.errorMessage,
          validation,
          allowedRange: validation.validRange
        });
      }
      
      console.log("Bid update validation passed:", validation.validRange);
      
    } catch (error) {
      return res.status(400).json({
        message: "Bid validation failed",
        error: error.message
      });
    }

    if (auction?.autoExtension === true) {
      const allActiveBids = await Bid.find({ auction: bid.auction, status: "Active", _id: { $ne: bidId } });

      const allAmounts = allActiveBids.map(b => b.amount);
      const isHighest = allAmounts.every(existingAmount => amount > existingAmount);

      if (isHighest) {
        // Extend the endTime by 5 minutes
        const extendedTime = new Date(auction.endTime.getTime() + 5 * 60000); // 5 mins in ms
        auction.endTime = extendedTime;
        await auction.save();
      }
    }

    // Update fields
    bid.amount = amount;
    bid.currency = currency; // Fixed: was using bid.currency instead of currency parameter
    bid.fob = fob;
    bid.tax = tax;
    bid.duty = duty;
    bid.performanceScore = performanceScore;
    bid.totalCost = amount*(bid.carton) + fob + tax + duty;
    bid.updatedAt = Date.now();

    await bid.save();
    
    // Record bid history
    try {
      const user = await User.findById(req.user.userId);
      console.log("saving bid history for user ", user.email);
      console.log("Update bid history - auctionId:", bid.auction, "lotId:", bid.lot, "supplier:", req.user.userId);
      
      await BidHistory.create({
        auction: bid.auction,
        lot: bid.lot,
        supplier: req.user.userId,
        amount,
        currency,
        carton: bid.carton,
        fob,
        tax,
        duty,
        totalCost: amount*(bid.carton) + fob + tax + duty,
        supplierName: user.name || user.email
      });
      console.log("savedd. ..... ");
      
    } catch (historyError) {
      console.error("Failed to record bid history:", historyError);
      // Don't fail the bid update if history recording fails
    }
    
    // Broadcast updated rankings to all users
    const io = req.app.get("io");
    await broadcastUpdatedRankings(io, bid.auction, auctionSettings);
    
    res.json({ message: "Bid updated", bid });
  } catch (err) {
    res.status(500).json({ message: "Bid update failed", error: err.message });
  }
};

// Get bid history for a supplier in an auction
export const getBidHistory = async (req, res) => {
  try {
    const { auctionId } = req.params;
    const bids = await Bid.find({
      auction: auctionId,
      supplier: req.user.userId,
    }).sort({ createdAt: -1 });
    res.json(bids);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch bid history", error: err.message });
  }
};

// export const getAuctionRanking = async (req, res) => {
//   try {
//     const { auctionId } = req.params;
//     const auction = await Auction.findById(auctionId);
//     if (!auction) return res.status(404).json({ message: "Auction not found" });

//     let bids;
//     if (req.user.role === "Supplier") {
//       // Only return this supplier's bids
//       bids = await Bid.find({ auction: auctionId, status: "Active", supplier: req.user.userId });
//     } else {
//       // For admin/EP, return all bids
//       bids = await Bid.find({ auction: auctionId, status: "Active" }).populate("lot supplier");
//     }

//     // Calculate weighted score if costParams are set
//     /*
//     const rankedBids = bids.map(bid => {
//       let score = 0;
//       if (auction.costParams) {
//         score += (bid.amount || 0) * (auction.costParams.priceWeight || 1);
//         score += (bid.fob || 0) * (auction.costParams.fobWeight || 0);
//         score += (bid.tax || 0) * (auction.costParams.taxWeight || 0);
//         score += (bid.duty || 0) * (auction.costParams.dutyWeight || 0);
//         score -= (bid.performanceScore || 0) * (auction.costParams.performanceWeight || 0);
//       } else {
//         score = bid.totalCost;
//       }
//       return { ...bid.toObject(), score };
//     });

//     // Sort by score ascending (lower is better)
//     rankedBids.sort((a, b) => a.score - b.score);
//     */
//     // Sort bids by amount (ascending)
//     const sortedBids = bids.sort((a, b) => a.amount - b.amount);

//     // Add rank field
//     const rankedBids = sortedBids.map((bid, idx) => ({
//       ...bid.toObject(),
//       rank: idx + 1
//     }));

//     res.json(rankedBids);
//   } catch (err) {
//     res.status(500).json({ message: "Failed to get auction ranking", error: err.message });
//   }
// };

export const getAuctionRanking = async (req, res) => {
  try {
    const { auctionId } = req.params;
    const auction = await Auction.findById(auctionId);
    if (!auction) return res.status(404).json({ message: "Auction not found" });

    let bids;

    if (req.user.role === "supplier") {
      // For suppliers, return only their bids with ranking
      bids = await Bid.find({ 
        auction: auctionId, 
        status: "Active", 
        supplier: req.user.userId 
      });
    } else {
      // For admin/EP, return all bids
      bids = await Bid.find({ auction: auctionId, status: "Active" }).populate("lot supplier");
    }

    // Sort by totalCost (lowest first for reverse auction)
    const sortedBids = bids.sort((a, b) => a.totalCost - b.totalCost);

    // Add rank field
    const rankedBids = sortedBids.map((bid, idx) => ({
      ...bid.toObject(),
      rank: idx + 1
    }));

    res.json(rankedBids);
  } catch (err) {
    res.status(500).json({ message: "Failed to get auction ranking", error: err.message });
  }
};

// Get auction bid constraints for frontend display
// Get complete bid history by lot and supplier
export const getCompleteBidHistory = async (req, res) => {
  try {
    const { lotId, supplierEmail } = req.query;
    
    if (!lotId && !supplierEmail) {
      return res.status(400).json({ 
        message: "Either lotId or supplierEmail is required" 
      });
    }

    let query = {}; 

    if (lotId) query.lot = lotId;
    if (supplierEmail) {
      // Find supplier by email first, then use their ID for the query
      const supplier = await User.findOne({ email: supplierEmail });
      if (supplier) {
        query.supplier = supplier._id;
      } else {
        // If supplier not found by email, return empty results
        return res.json({
          bidHistory: [],
          total: 0,
          query: { supplierEmail, found: false }
        });
      }
    }

    const bidHistory = await BidHistory.find(query)
    .populate('lot', 'name')
      .populate('supplier', 'name email profile')
      .sort({ createdAt: -1 })
      .limit(100);
console.log("bid histoarryyy ", bidHistory);

    res.json({
      bidHistory,
      total: bidHistory.length,
      query
    });
  } catch (error) {
    res.status(500).json({ 
      message: "Failed to fetch bid history", 
      error: error.message 
    });
  }
};

export const getAuctionBidConstraints = async (req, res) => {
  try {
    const { auctionId } = req.params;
    
    const auction = await Auction.findById(auctionId);
    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    // Fetch auction settings directly from AuctionSettings table using event_id
    const auctionSettings = await AuctionSettings.findOne({ event_id: auction.event_id });

    if (!auctionSettings) {
      return res.status(400).json({ 
        message: "Auction settings not configured. Please set up auction settings with increment limits." 
      });
    }

    // Check if increment percentages are configured
    if (!auctionSettings.minimum_bid_change || !auctionSettings.maximum_bid_change) {
      return res.status(400).json({ 
        message: "Bid increment percentages not configured. Please set minimum_bid_change and maximum_bid_change (e.g., 0.5 for 0.5%, 10 for 10%)." 
      });
    }

    // For constraints, we need a lot to get the current_price
    // We'll show general constraints without specific lot reference
    const constraints = {
      bidDirection: auctionSettings.bid_direction || "reverse",
      minBidPercentage: auctionSettings.minimum_bid_change, // e.g., 0.5 (represents 0.5% increment)
      maxBidPercentage: auctionSettings.maximum_bid_change, // e.g., 10 (represents 10% increment)
      currency: auction.default_currency || "GBP",
      explanation: `Bids must be between ${auctionSettings.minimum_bid_change}% and ${auctionSettings.maximum_bid_change}% increment above the lot's current price`
    };

    // If there's a specific lot in the query, we can show calculated ranges
    const { lotId } = req.query;
    if (lotId) {
      const lot = await eventLot.findById(lotId);
      if (lot && lot.current_price) {
        const minIncrement = (lot.current_price * constraints.minBidPercentage) / 100;
        const maxIncrement = (lot.current_price * constraints.maxBidPercentage) / 100;
        const floorPrice = lot.current_price + minIncrement;
        const ceilingPrice = lot.current_price + maxIncrement;
        
        constraints.referencePrice = lot.current_price;
        constraints.minIncrement = minIncrement;
        constraints.maxIncrement = maxIncrement;
        constraints.floorPrice = floorPrice;
        constraints.ceilingPrice = ceilingPrice;
        constraints.validRange = `${floorPrice.toFixed(2)} - ${ceilingPrice.toFixed(2)} ${auction.default_currency || "GBP"}`;
        constraints.explanation = `For this lot: Bids must be between ${floorPrice.toFixed(2)} (current price ${lot.current_price} + ${constraints.minBidPercentage}% increment) and ${ceilingPrice.toFixed(2)} (current price ${lot.current_price} + ${constraints.maxBidPercentage}% increment) ${auction.default_currency || "GBP"}`;
      }
    }

    // Get current user's active bid if exists
    const userBid = await Bid.findOne({
      auction: auctionId,
      supplier: req.user.userId,
      status: "Active"
    });

    res.json({
      constraints,
      currentBid: userBid ? {
        amount: userBid.amount,
        currency: userBid.currency,
        totalCost: userBid.totalCost
      } : null
    });

  } catch (err) {
    res.status(500).json({ 
      message: "Failed to get auction constraints", 
      error: err.message 
    });
  }
};