/**
 * UPDATED AUCTION CONTROLLER - NORMALIZED STRUCTURE
 * 
 * This demonstrates how to work with the normalized auction model
 * Key changes:
 * 1. Create separate documents for auction settings, questionnaires, etc.
 * 2. Use references instead of embedded documents
 * 3. Use populate() to fetch related data
 */

import Auction from "../models/auction.js";
import Event from "../models/event.js";
import AuctionSettings from "../models/auctionSettings.js";
import Questionnaire from "../models/questionnaire.js";
import EventDocument from "../models/eventDocument.js";
import EventLot from "../models/eventLot.js";
import EventParticipant from "../models/eventParticipant.js";
import mongoose from 'mongoose';
import User from "../models/user.js";

// Example: Create Complete Event/Auction with Normalized Structure (No Transactions)
export const createCompleteEventNormalized = async (req, res) => {
  console.log("Creating auction with normalized structure:", req.body);
  
  try {
    const {
      name,
      category,
      default_currency,
      brief_text,
      include_auction,
      include_questionnaire,
      include_rfq,
      auction_settings,
      questionnaires,
      documents,
      lots,
      participants,
      auto_accept,
    } = req.body;

    // 1. Create the main auction document first
    const currentYear = new Date().getFullYear();
    const uniqueThreeDigitNumber = Math.floor(Math.random() * 900) + 100;
    const auctionId = `AUC-${currentYear}-CC-${uniqueThreeDigitNumber}`;

    const auction = new Auction({
      title: name,
      auctionId,
      category,
      brief_text,
      default_currency: default_currency || "GBP",
      include_auction: include_auction || false,
      include_questionnaire: include_questionnaire || false,
      include_rfq: include_rfq || false,
      status: "draft",
      auto_accept: auto_accept || false,
      createdBy: req.user.userId,
    });

    const savedAuction = await auction.save();

    // 2. Create AuctionSettings if auction is included
    let auctionSettingsId = null;
    if (include_auction && auction_settings) {
      const auctionSettingsDoc = new AuctionSettings({
        event_id: savedAuction._id, // Reference the auction instead of event
        ...auction_settings
      });
      const savedSettings = await auctionSettingsDoc.save();
      auctionSettingsId = savedSettings._id;
    }

    // 3. Create Questionnaires if included
    const questionnaireIds = [];
    if (include_questionnaire && questionnaires?.length > 0) {
      for (const questionnaire of questionnaires) {
        const questionnaireDoc = new Questionnaire({
          event_id: savedAuction._id,
          ...questionnaire
        });
        const savedQuestionnaire = await questionnaireDoc.save();
        questionnaireIds.push(savedQuestionnaire._id);
      }
    }

    // 4. Create EventDocuments if provided
    const documentIds = [];
    if (documents?.length > 0) {
      for (const document of documents) {
        const documentDoc = new EventDocument({
          event_id: savedAuction._id,
          ...document
        });
        const savedDocument = await documentDoc.save();
        documentIds.push(savedDocument._id);
      }
    }

    // 5. Create EventLots if RFQ is included
    const lotIds = [];
    if (include_rfq && lots?.length > 0) {
      for (const lot of lots) {
        const lotDoc = new EventLot({
          event_id: savedAuction._id,
          ...lot
        });
        const savedLot = await lotDoc.save();
        lotIds.push(savedLot._id);
      }
    }

    // 6. Create EventParticipants
    const participantIds = [];
    if (participants?.length > 0) {
      for (const participant of participants) {
        const participantDoc = new EventParticipant({
          event_id: savedAuction._id,
          ...participant
        });
        const savedParticipant = await participantDoc.save();
        participantIds.push(savedParticipant._id);
      }
    }

    // 7. Update auction with all the references
    savedAuction.auction_settings = auctionSettingsId;
    savedAuction.questionnaires = questionnaireIds;
    savedAuction.event_documents = documentIds;
    savedAuction.event_lots = lotIds;
    savedAuction.participants = participantIds;
    
    // Legacy compatibility - also populate invitedSupplierEmail
    savedAuction.invitedSupplierEmail = participants?.map(p => p.participant.email) || [];

    await savedAuction.save();

    // 8. Fetch the complete auction with populated references
    const completeAuction = await Auction.findById(savedAuction._id)
      .populate('auction_settings')
      .populate('questionnaires')
      .populate('event_documents')
      .populate('event_lots')
      .populate('participants')
      .populate('createdBy', 'name email');

    res.status(201).json({
      message: "Event created successfully",
      auction: completeAuction
    });

  } catch (error) {
    console.error("Error creating event:", error);
    
    // Cleanup: If there was an error, try to remove any partially created documents
    // Note: In production with replica sets, you'd use transactions instead
    try {
      if (error.auctionId) {
        await Auction.findByIdAndDelete(error.auctionId);
      }
    } catch (cleanupError) {
      console.error("Error during cleanup:", cleanupError);
    }
    
    res.status(500).json({ 
      message: "Error creating event", 
      error: error.message 
    });
  }
};

// Example: Get auction with all populated references
export const getAuctionByIdNormalized = async (req, res) => {
  try {
    const auctionId = req.params.id;
    
    const auction = await Auction.findById(auctionId)
      .populate('auction_settings')
      .populate('questionnaires')
      .populate('event_documents')
      .populate('event_lots')
      .populate('participants')
      .populate('createdBy', 'name email')
      .populate('lots'); // Legacy support

    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    res.json(auction);
  } catch (error) {
    console.error("Error fetching auction:", error);
    res.status(500).json({ 
      message: "Error fetching auction", 
      error: error.message 
    });
  }
};

// Example: Update auction with normalized structure (No Transactions)
export const updateAuctionNormalized = async (req, res) => {
  try {
    const auctionId = req.params.id;
    const updateData = req.body;
    
    // Find the auction
    const auction = await Auction.findById(auctionId);
    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    // Check ownership
    if (auction.createdBy.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Update main auction fields
    Object.assign(auction, {
      title: updateData.name || auction.title,
      category: updateData.category || auction.category,
      brief_text: updateData.brief_text || auction.brief_text,
      // ... other fields
    });

    // Update or create auction settings
    if (updateData.auction_settings) {
      if (auction.auction_settings) {
        await AuctionSettings.findByIdAndUpdate(
          auction.auction_settings, 
          updateData.auction_settings
        );
      } else {
        const newSettings = new AuctionSettings({
          event_id: auctionId,
          ...updateData.auction_settings
        });
        const savedSettings = await newSettings.save();
        auction.auction_settings = savedSettings._id;
      }
    }

    // Update questionnaires
    if (updateData.questionnaires) {
      // Delete existing questionnaires
      if (auction.questionnaires?.length > 0) {
        await Questionnaire.deleteMany({ 
          _id: { $in: auction.questionnaires }
        });
      }
      
      // Create new questionnaires
      const newQuestionnaireIds = [];
      for (const questionnaire of updateData.questionnaires) {
        const questionnaireDoc = new Questionnaire({
          event_id: auctionId,
          ...questionnaire
        });
        const saved = await questionnaireDoc.save();
        newQuestionnaireIds.push(saved._id);
      }
      auction.questionnaires = newQuestionnaireIds;
    }

    // Similar updates for documents, lots, participants...

    await auction.save();

    // Return populated auction
    const updatedAuction = await Auction.findById(auctionId)
      .populate('auction_settings')
      .populate('questionnaires')
      .populate('event_documents')
      .populate('event_lots')
      .populate('participants');

    res.json({
      message: "Auction updated successfully",
      auction: updatedAuction
    });

  } catch (error) {
    console.error("Error updating auction:", error);
    res.status(500).json({ 
      message: "Error updating auction", 
      error: error.message 
    });
  }
};
        await Questionnaire.deleteMany({ 
          _id: { $in: auction.questionnaires }
        }, { session });
      }
      
      // Create new questionnaires
      const newQuestionnaireIds = [];
      for (const questionnaire of updateData.questionnaires) {
        const questionnaireDoc = new Questionnaire({
          event_id: auctionId,
          ...questionnaire
        });
        const saved = await questionnaireDoc.save({ session });
        newQuestionnaireIds.push(saved._id);
      }
      auction.questionnaires = newQuestionnaireIds;
    }

    // Similar updates for documents, lots, participants...

    await auction.save({ session });
    await session.commitTransaction();

    // Return populated auction
    const updatedAuction = await Auction.findById(auctionId)
      .populate('auction_settings')
      .populate('questionnaires')
      .populate('event_documents')
      .populate('event_lots')
      .populate('participants');

    res.json({
      message: "Auction updated successfully",
      auction: updatedAuction
    });

  } catch (error) {
    await session.abortTransaction();
    console.error("Error updating auction:", error);
    res.status(500).json({ 
      message: "Error updating auction", 
      error: error.message 
    });
  } finally {
    session.endSession();
  }
};

// Example: List auctions with basic populated data
export const listAuctionsNormalized = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const auctions = await Auction.find()
      .populate('auction_settings', 'start_date start_time event_type') // Only populate needed fields
      .populate('createdBy', 'name email')
      .select('title auctionId category status createdAt') // Only select needed fields
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Auction.countDocuments();

    res.json({
      auctions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching auctions:", error);
    res.status(500).json({ 
      message: "Error fetching auctions", 
      error: error.message 
    });
  }
};

export default {
  createCompleteEventNormalized,
  getAuctionByIdNormalized,
  updateAuctionNormalized,
  listAuctionsNormalized
};
